## 개요

- 워크플로우 생성/분해(stateless) → 도구 추천(`tools`) → **AI 가이드 생성**(`tool_guides`) → 문의 접수(`contact`)
- 벡터/하이브리드 검색 함수(`match_tools`, `hybrid_search_tools`)와 인덱스로 추천 성능 최적화
- **NEW**: 웹 검색 기반 맞춤형 도구 사용법 가이드 생성 및 캐싱 시스템

---
## tools

추천 대상 도구 메타데이터 + 검색 최적화용 필드 보관

- id (UUID, PK)
- created_at (timestamptz), updated_at (timestamptz): 변경 추적. `update_tools_updated_at` 트리거로 자동 갱신
- name (text, UNIQUE): 도구 고유 식별용 표시명. 빠른 탐색 인덱스 존재
- description (text): 요약 설명. 텍스트/하이브리드 검색에 활용
- url (text): 외부 도구 이동 링크. UI에서 즉시 이동 액션에 사용
- logo_url (text): 로고 표시 경로. UI 가독성/브랜드 인지도 강화
- categories (text[]): 분류/필터링/텍스트 유사도에 활용. GIN 인덱스
- embedding_text (text): 임베딩 생성 원문(콘텐츠). `match_tools` content로 반환
- embedding (vector(768)): pgvector 기반 유사도 검색 대상. IVFFLAT 인덱스
- is_active (boolean, default true): 비활성화/숨김 처리. 모든 검색에서 활성만 대상
- bench_score (numeric): 성능 지표(벤치마크) 기반 가중치
- domains (text[]): 적용 도메인(예: 'code', 'general'). 쿼리 맥락 매칭 가중치에 사용
- cost_index (numeric): 비용 민감도 반영 가중치

**인덱스**:

- `idx_tools_name` (name)
- `idx_tools_name_gin` (name gin_trgm_ops)
- `idx_tools_categories` (categories GIN)
- `idx_tools_description_gin` (description gin_trgm_ops)
- `idx_tools_active` (is_active) WHERE is_active = true
- `idx_tools_active_with_embedding` (is_active) WHERE is_active = true AND embedding IS NOT NULL
- `idx_tools_embedding_optimized` (embedding IVFFLAT vector_cosine_ops) WITH (lists='10')

**RLS**: 공용 읽기 허용, 수정은 service_role 제한(관리 목적)
**주요 사용처**:

- `src/lib/supabase/vector-store.ts` (벡터/하이브리드/키워드 검색, 메타데이터 매핑)
- `src/lib/services/workflow-service.ts` (bench_score/domains/cost_index 가중치 기반 스코어링, url/logo_url 동시 조회)
- UI: 추천 카드에 `name`, `logo_url`, `url` 노출

## tool_guides

AI 기반 도구 사용법 가이드 저장소. 웹 검색 + Google Gemini로 생성된 맞춤형 가이드 보관

- id (UUID, PK): 가이드 고유 식별자
- tool_id (UUID, FK → tools.id, ON DELETE CASCADE): 대상 도구 참조
- task_context (text, NOT NULL): 사용자 업무 맥락 (예: "웹사이트 디자인", "데이터 분석")
- guide_content (jsonb, NOT NULL): 구조화된 가이드 데이터 (summary, sections[])
- source_urls (text[], default '{}'): 참조한 웹 자료 URL 목록
- confidence_score (numeric(3,2), 0-1 범위): AI 생성 품질 신뢰도
- language (text, default 'ko'): 가이드 언어
- created_at/updated_at (timestamptz): 생성/수정 시각 추적
- expires_at (timestamptz, default +24h): 가이드 만료 시간 (자동 정리용)

**인덱스**:
- `idx_tool_guides_tool_context` (tool_id, task_context): 복합 조회 최적화
- `idx_tool_guides_expires` (expires_at): 만료 기반 정리 최적화
- `idx_tool_guides_language`, `idx_tool_guides_confidence`, `idx_tool_guides_created_at`

**RLS**: 
- 공용 읽기 허용 (모든 가이드 공개)
- service_role/authenticated만 생성 가능
- service_role만 수정/삭제 (시스템 관리용)

**주요 사용처**: 
- `src/app/api/tools/[tool_id]/guide/route.ts` (가이드 조회/생성)
- `src/app/api/tools/[tool_id]/guide/stream/route.ts` (실시간 생성 스트리밍)
- `src/lib/services/guide-generation-service.ts` (AI 가이드 생성 로직)
- `src/components/GuideModal.tsx` (UI 표시)

## search_cache

웹 검색 결과 캐싱으로 API 비용 절약 및 성능 최적화

- search_key (text, PK): 검색 쿼리 해시값
- search_results (jsonb, NOT NULL): 검색 결과 데이터
- result_count (integer, default 0): 결과 개수
- language (text, default 'ko'): 검색 언어
- created_at (timestamptz): 캐시 생성 시간
- expires_at (timestamptz, default +24h): 캐시 만료 시간

**인덱스**: expires_at, language, created_at DESC
**RLS**: service_role 전용 (내부 시스템 캐시)
**주요 사용처**: `src/lib/services/web-search-service.ts`

## users (public)

`auth.users`와 1:1 확장된 공개 프로필

- id (UUID, PK, FK → auth.users.id, ON DELETE CASCADE): 인증 시스템과 연동
- full_name (text)
- avatar_url (text)
- created_at/updated_at (timestamptz): 변경 추적(트리거로 업데이트)
- plan (enum: 'free' | 'plus', default 'free'): 플랜 구분(기능 제한/확장에 활용)

**RLS**: 모두 읽기 가능, 본인 행에 한해 INSERT/UPDATE 허용
**트리거**: `handle_new_user` → 신규 가입 시 자동 프로필 생성
**주요 사용처**: 사용자 플랜에 따른 기능 토글

## contact

문의/제휴/지원/피드백 등 외부 접점 수집

- id (bigint, identity, PK)
- inquiry_type (enum: general|partnership|support|feedback, default 'general'): 문의 유형 분류
- email (text, 이메일 정규식 체크): 회신 주소 검증
- message (text, length 10–2000): 문의 내용
- user_id (UUID, FK → users.id, NULL 허용): 비로그인 제출 지원
- created_at/updated_at (timestamptz)

**인덱스**: inquiry_type, user_id, created_at DESC
**RLS**: 누구나 INSERT 가능, 본인(user_id) 또는 비로그인(NULL) 레코드 SELECT 가능
**주요 사용처**: `src/app/api/contact/route.ts`

---

## 데이터베이스 함수/뷰/트리거

### 핵심 함수

- `update_updated_at_column()`: UPDATED ROW의 `updated_at` 자동 갱신용 공용 트리거 함수
- `match_tools(query_embedding, match_threshold, match_count)`: LangChain 호환 벡터 검색. `tools.embedding_text`와 메타 반환
- `hybrid_search_tools(query_text, query_embedding, match_count, vector_weight, text_weight)`: 벡터 + 텍스트 가중 혼합 검색
- `check_vector_index_performance()`: 임베딩 인덱스 사용량 점검용
- `refresh_active_tools_view()`: MV 리프레시 함수
- **NEW**: `cleanup_expired_cache()`: 만료된 가이드 및 캐시 자동 정리 (returns 삭제 개수)

### 트리거

- `update_workflow_status`: 제거됨 (상태 업데이트는 애플리케이션 레이어에서 처리)
- `handle_new_user`: 신규 사용자 가입 시 자동 프로필 생성
- **NEW**: `update_tool_guides_updated_at`: `tool_guides` 테이블 수정 시 `updated_at` 자동 갱신

### 뷰

- **NEW**: `active_tool_guides`: 만료되지 않은 가이드 + 도구 정보 조인 뷰 (anon/authenticated 읽기 권한)

### 확장 기능

- **pg_trgm**: 텍스트 유사도 검색 (trigram 기반)
- **vector**: pgvector 임베딩 검색 (IVFFLAT, HNSW 인덱스 지원)
- **GIN 인덱스**: categories 배열 및 텍스트 검색 최적화

---

## 인덱스/성능 설계 요지

- **IVFFLAT(embedding)**: 파라미터 최적화(lists=10)로 소규모 데이터셋 대응
- **GIN(categories)**: 배열 기반 카테고리 검색 성능 확보
- **GIN + trigram**: 텍스트 유사도 검색 (name, description)
- **Partial 인덱스**: `is_active = true` 조건으로 활성 도구만 인덱싱
- **복합 인덱스**: (workflow_id, order_index)로 작업 순서 정렬 최적화
- **created_at/상태 인덱스**: 최근/상태별 목록화 비용 절감

---

## 보안/RLS 정책 요지

- **공용 읽기**: `tools`, `tool_guides` (모든 가이드 공개)
- **제한 쓰기**: 서비스 로직은 서버 측 `service_role`로 INSERT/UPDATE 수행
- **사용자 데이터**: `users`, `contact`는 사용자 소유권에 따라 RLS 분기
- **트리거 보안**: `update_updated_at_column` 등 공용 함수는 안전한 메타데이터 갱신만 수행
- **NEW 캐시 보안**: `search_cache`는 service_role 전용 (내부 캐싱 용도)
- **NEW 가이드 정책**: authenticated/service_role만 가이드 생성, 만료된 가이드 자동 삭제

---

## 프런트엔드 사용 포인트 맵

- **추천 카드(작업별)**: `tools.name`, `tools.logo_url`, `tools.url`, 추천 사유/점수는 런타임 계산
- **검색 백엔드**: `match_tools`/`hybrid_search_tools` → `vector-store.ts` → 후보 id → 상세 스코어링(`bench_score`, `domains`, `cost_index`)
- **NEW 가이드 시스템**: TaskCard "상세 가이드" 버튼 → GuideModal → `/api/tools/[id]/guide` → `tool_guides` 조회/생성
- **NEW 가이드 데이터**: `guide_content.summary`, `guide_content.sections[]`, `source_urls`, `confidence_score`

---

## 향후 개선 제안

### 기존 시스템 개선
- **tools 확장**: `difficulty_level`, `budget_range` 추가 및 인덱스
- **정책 다중화**: 시나리오별 정책 행을 다중 보관하고 선택 적용
- **성능 모니터링**: `check_vector_index_performance()` 정기 실행으로 인덱스 효율성 점검
- **RLS 점검**: `tools` 수정 정책에 INSERT/UPDATE에 대한 WITH CHECK 구문을 명시적으로 분리하여 의도 강화

### 가이드 시스템 개선 (NEW)
- **사용자 평가**: `guide_ratings` 테이블로 가이드 품질 피드백 수집
- **가이드 개인화**: 사용자별 선호도/경험 수준 반영한 맞춤형 가이드
- **버전 관리**: 도구 업데이트 시 가이드 자동 갱신 알림
- **캐시 최적화**: `search_cache` TTL 동적 조정, 인기 검색어 우선 캐싱
- **성능 모니터링**: 가이드 생성 시간, 캐시 히트율, API 비용 추적
- **정기 정리**: `cleanup_expired_cache()` 크론잡 스케줄링
