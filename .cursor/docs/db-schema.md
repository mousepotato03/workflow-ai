## 개요

- 워크플로우 생성/분해(`workflows`, `tasks`) → 도구 추천(`tools`) → 문의 접수(`contact`)
- 벡터/하이브리드 검색 함수(`match_tools`, `hybrid_search_tools`)와 인덱스로 추천 성능 최적화

---

## workflows

사용자 목표를 워크플로우 단위로 관리하는 루트 엔터티

- id (UUID, PK, default gen_random_uuid): 워크플로우 식별자
- created_at (timestamptz, default now): 생성 시점. 최신 정렬/모니터링 용도. 인덱스 존재
- goal (text, length 10–200): 사용자가 입력한 목표. 유효성 체크
- language (text, default 'ko'): 워크플로우 처리 언어. API에서 검증 결과로 업데이트
- status (text, default 'processing', {processing|completed|failed}): 처리 상태. 추천 완료 트리거로 자동 갱신
- metadata (jsonb, default '{}'): 확장 메타. 릴리즈마다 스키마 변경 없이 부가정보 보관

**인덱스**:

- `idx_workflows_created_at` (created_at DESC)
- `idx_workflows_language` (language)
- `idx_workflows_status` (status)

**RLS**: 공용 읽기 허용(SELECT), 쓰기는 service_role 위주
**주요 사용처**: `src/app/api/workflow/route.ts` (생성/완료 업데이트)

## tasks

목표를 세부 단계로 분해해 순서를 보장하는 하위 엔터티

- id (UUID, PK)
- workflow_id (UUID, FK → workflows.id, ON DELETE CASCADE): 부모 워크플로우 연결
- created_at (timestamptz)
- order_index (int, >=1, UNIQUE(workflow_id, order_index)): 단계 순서 고정 및 중복 방지. 최대 단계 제한 제거됨
- name (text): 단계 이름(LLM 분해 결과)

**인덱스**:

- `idx_tasks_workflow_id` (workflow_id)
- `idx_tasks_order` (workflow_id, order_index)
- `tasks_workflow_id_order_index_key` (workflow_id, order_index) UNIQUE

**RLS**: 공용 읽기, 쓰기는 service_role 위주
**주요 사용처**: `src/app/api/workflow/route.ts` (일괄 삽입 및 추천 입력), UI 정렬 표시

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

<!-- recommendations 테이블은 제거되었습니다. 결과는 비영속으로 처리됩니다. -->

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

<!-- recommendation_policy 테이블은 제거되었습니다. 기본 가중치는 코드 상수로 처리됩니다. -->

---

## 데이터베이스 함수/뷰/트리거

### 핵심 함수

- `update_updated_at_column()`: UPDATED ROW의 `updated_at` 자동 갱신용 공용 트리거 함수
- `match_tools(query_embedding, match_threshold, match_count)`: LangChain 호환 벡터 검색. `tools.embedding_text`와 메타 반환
- `hybrid_search_tools(query_text, query_embedding, match_count, vector_weight, text_weight)`: 벡터 + 텍스트 가중 혼합 검색
- `check_vector_index_performance()`: 임베딩 인덱스 사용량 점검용
- `refresh_active_tools_view()`: MV 리프레시 함수

### 트리거

- `update_workflow_status`: 제거됨 (상태 업데이트는 애플리케이션 레이어에서 처리)
- `handle_new_user`: 신규 사용자 가입 시 자동 프로필 생성

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

- **공용 읽기**: `workflows`, `tasks`, `tools`
- **제한 쓰기**: 서비스 로직은 서버 측 `service_role`로 INSERT/UPDATE 수행
- **사용자 데이터**: `users`, `contact`는 사용자 소유권에 따라 RLS 분기
- **트리거 보안**: `update_updated_at_column` 등 공용 함수는 안전한 메타데이터 갱신만 수행

---

## 프런트엔드 사용 포인트 맵

- **추천 카드(작업별)**: `tools.name`, `tools.logo_url`, `tools.url`, 추천 사유/점수는 런타임 계산
- **검색 백엔드**: `match_tools`/`hybrid_search_tools` → `vector-store.ts` → 후보 id → 상세 스코어링(`bench_score`, `domains`, `cost_index`)
- **정책 주입**: `recommendation_policy.weights` → 점수 계산식에 반영

---

<!-- 데이터 현황 섹션은 운영 시 기준이 변동되어 제거되었습니다. -->

## 향후 개선 제안

- **tools 확장**: `difficulty_level`, `budget_range` 추가 및 인덱스
- **정책 다중화**: 시나리오별 정책 행을 다중 보관하고 선택 적용
- **recommendations.alternatives 활용**: 상위 N 대안과 요약 사유 동시 표출
- **성능 모니터링**: `check_vector_index_performance()` 정기 실행으로 인덱스 효율성 점검
- **RLS 점검**: `tools` 수정 정책에 INSERT/UPDATE에 대한 WITH CHECK 구문을 명시적으로 분리하여 의도 강화
