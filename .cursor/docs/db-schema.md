## 개요

- 워크플로우 생성/분해(stateless) → 도구 추천(`tools`) → **AI 가이드 생성**(`tool_guides`) → 문의 접수(`contact`)
- 벡터/하이브리드 검색 함수(`match_tools`, `hybrid_search_tools`)와 인덱스로 추천 성능 최적화
- **웹 검색 기반 맞춤형 도구 사용법 가이드 생성 및 캐싱 시스템**
- **사용자 기능**: 북마크(`bookmarks`), 리뷰/평점(`reviews`) 시스템으로 개인화 강화

## API 구조

### Guide Generation APIs

**현재 사용 중인 API:**

1. **`/api/tools/[tool_id]/guide`** (GET/POST)

   - **용도**: 개별 도구의 사용 가이드 생성 및 조회
   - **GET**: 캐시된 가이드 조회 (taskContext, language 쿼리 파라미터)
   - **POST**: 새 가이드 생성 (캐싱, 에러 처리, 레이트 리미팅 포함)
   - **특징**: 구조화된 JSON 응답 (summary, sections[])

2. **`/api/tools/[tool_id]/guide/stream`** (POST)
   - **용도**: 실시간 스트리밍 가이드 생성
   - **특징**: Server-Sent Events로 진행 상황 스트리밍
   - **단계**: tool_lookup → cache_check → web_search → guide_generation → complete

**권장 사용 패턴:**

- UI에서 개별 도구 가이드: `/api/tools/[tool_id]/guide` 또는 `/stream` 버전
- 워크플로우 다중 가이드: 개별 도구 API를 순차 호출
- 캐싱 활용: GET 요청으로 기존 가이드 확인 후 POST로 생성

---

## 테이블 스키마

### tools

추천 대상 도구 메타데이터 + 검색 최적화용 필드 보관

- **id** (UUID, PK): 도구 고유 식별자
- **created_at** (timestamptz): 생성 시각, 기본값 `now()`
- **updated_at** (timestamptz): 수정 시각, 기본값 `now()`
- **name** (text, UNIQUE): 도구 고유 식별용 표시명
- **description** (text): 요약 설명. 텍스트/하이브리드 검색에 활용
- **url** (text): 외부 도구 이동 링크
- **logo_url** (text): 로고 표시 경로
- **categories** (text[], 기본값 `{}`): 분류/필터링/텍스트 유사도에 활용
- **embedding_text** (text): 임베딩 생성 원문(콘텐츠)
- **embedding** (vector(768)): pgvector 기반 유사도 검색 대상
- **is_active** (boolean, 기본값 `true`): 비활성화/숨김 처리
- **bench_score** (numeric): 성능 지표(벤치마크) 기반 가중치
- **domains** (text[], 기본값 `{}`): 적용 도메인(예: 'code', 'general')
- **cost_index** (numeric): 비용 민감도 반영 가중치
- **scores** (jsonb, 기본값 `{}`): 정량 메타데이터 및 가격모델 저장 필드
  - 예시 구조
    - `benchmarks` (객체): {HumanEval: 88.4, MMLU: 80.2}
    - `user_rating` (객체): {G2: 4.7, Capterra: 4.6}
    - `pricing_model` (문자열): "free" | "paid" | "freemium"

**인덱스:**

- `tools_pkey` (id) - 기본키
- `tools_name_key` (name) - UNIQUE 제약
- `idx_tools_name` (name) - 이름 검색 최적화
- `idx_tools_name_gin` (name gin_trgm_ops) - 이름 trigram 검색
- `idx_tools_categories` (categories GIN) - 카테고리 배열 검색
- `idx_tools_description_gin` (description gin_trgm_ops) - 설명 trigram 검색
- `idx_tools_active` (is_active) WHERE is_active = true - 활성 도구만
- `idx_tools_active_with_embedding` (is_active) WHERE is_active = true AND embedding IS NOT NULL
- `idx_tools_embedding_optimized` (embedding IVFFLAT vector_cosine_ops) WITH (lists='10')
- `idx_tools_scores_gin` (scores jsonb_path_ops)

**RLS**: 공용 읽기 허용, 수정은 service_role 제한(관리 목적)

### tool_guides

AI 기반 도구 사용법 가이드 저장소. 웹 검색 + Google Gemini로 생성된 맞춤형 가이드 보관

- **id** (UUID, PK): 가이드 고유 식별자, 기본값 `gen_random_uuid()`
- **tool_id** (UUID, NOT NULL): 대상 도구 참조
- **task_context** (text, NOT NULL): 사용자 업무 맥락 (예: "웹사이트 디자인", "데이터 분석")
- **guide_content** (jsonb, NOT NULL): 구조화된 가이드 데이터 (summary, sections[])
- **source_urls** (text[], 기본값 `{}`): 참조한 웹 자료 URL 목록
- **confidence_score** (numeric, 0-1 범위): AI 생성 품질 신뢰도
- **language** (text, 기본값 'ko'): 가이드 언어
- **created_at** (timestamptz): 생성 시각, 기본값 `now()`
- **updated_at** (timestamptz): 수정 시각, 기본값 `now()`
- **expires_at** (timestamptz, 기본값 +24h): 가이드 만료 시간

**인덱스:**

- `tool_guides_pkey` (id) - 기본키
- `idx_tool_guides_tool_context` (tool_id, task_context) - 복합 조회 최적화
- `idx_tool_guides_expires` (expires_at) WHERE expires_at IS NOT NULL - 만료 기반 정리
- `idx_tool_guides_language` (language) - 언어별 조회
- `idx_tool_guides_confidence` (confidence_score DESC) - 품질 기반 정렬
- `idx_tool_guides_created_at` (created_at DESC) - 생성일 기반 정렬
- `idx_tool_guides_performance` (tool_id, expires_at, confidence_score DESC) - 성능 최적화

**RLS**: 공용 읽기 허용, service_role/authenticated만 생성 가능

### search_cache

웹 검색 결과 캐싱으로 API 비용 절약 및 성능 최적화

- **search_key** (text, PK): 검색 쿼리 해시값
- **search_results** (jsonb, NOT NULL): 검색 결과 데이터
- **result_count** (integer, 기본값 0): 결과 개수
- **language** (text, 기본값 'ko'): 검색 언어
- **created_at** (timestamptz): 캐시 생성 시간, 기본값 `now()`
- **expires_at** (timestamptz, 기본값 +24h): 캐시 만료 시간

**인덱스:**

- `search_cache_pkey` (search_key) - 기본키
- `idx_search_cache_expires` (expires_at) WHERE expires_at IS NOT NULL - 만료 기반 정리
- `idx_search_cache_language` (language) - 언어별 조회
- `idx_search_cache_created_at` (created_at DESC) - 생성일 기반 정렬

**RLS**: service_role 전용 (내부 시스템 캐시)

### bookmarks

사용자별 도구 북마크 관리 시스템

- **id** (UUID, PK): 북마크 고유 식별자, 기본값 `gen_random_uuid()`
- **user_id** (UUID, NOT NULL): 사용자 참조
- **tool_id** (UUID, NOT NULL): 북마크된 도구 참조
- **created_at** (timestamptz): 생성 시각, 기본값 `now()`
- **updated_at** (timestamptz): 수정 시각, 기본값 `now()`

**인덱스:**

- `bookmarks_pkey` (id) - 기본키
- `bookmarks_user_id_tool_id_key` (user_id, tool_id) - UNIQUE 제약
- `idx_bookmarks_user_id` (user_id) - 사용자별 조회
- `idx_bookmarks_tool_id` (tool_id) - 도구별 조회
- `idx_bookmarks_tool_user` (tool_id, user_id) - 복합 조회
- `idx_bookmarks_user_timeline` (user_id, created_at DESC) - 사용자별 최신 북마크

**RLS**: 사용자는 본인 북마크만 CRUD 가능, service_role은 모든 북마크 관리 가능

### reviews

도구 리뷰 및 평점 시스템

- **id** (UUID, PK): 리뷰 고유 식별자, 기본값 `gen_random_uuid()`
- **user_id** (UUID, NOT NULL): 리뷰 작성자
- **tool_id** (UUID, NOT NULL): 리뷰 대상 도구
- **rating** (integer, CHECK 1-5): 별점 평가
- **comment** (text, CHECK 10-2000 chars): 리뷰 내용 (선택사항)
- **created_at** (timestamptz): 생성 시각, 기본값 `now()`
- **updated_at** (timestamptz): 수정 시각, 기본값 `now()`

**제약조건:**

- UNIQUE(user_id, tool_id): 사용자당 도구별 하나의 리뷰만 허용
- rating: 1-5 범위 제한
- comment: NULL 허용, 작성 시 10-2000자 제한

**인덱스:**

- `reviews_pkey` (id) - 기본키
- `reviews_user_id_tool_id_key` (user_id, tool_id) - UNIQUE 제약
- `idx_reviews_user_id` (user_id) - 사용자별 조회
- `idx_reviews_tool_id` (tool_id) - 도구별 조회
- `idx_reviews_rating` (rating) - 평점별 조회
- `idx_reviews_tool_rating_performance` (tool_id, rating, created_at DESC) - 성능 최적화
- `idx_reviews_tool_timeline` (tool_id, created_at DESC) - 도구별 최신 리뷰
- `idx_reviews_user_timeline` (user_id, created_at DESC) - 사용자별 최신 리뷰

**RLS**: 모든 리뷰 읽기 가능 (공개), 사용자는 본인 리뷰만 작성/수정 가능

### users (public)

`auth.users`와 1:1 확장된 공개 프로필

- **id** (UUID, PK, FK → auth.users.id): 인증 시스템과 연동
- **full_name** (text): 사용자 전체 이름
- **avatar_url** (text): 프로필 이미지 URL
- **created_at** (timestamptz): 생성 시각, 기본값 `now()`
- **updated_at** (timestamptz): 수정 시각, 기본값 `now()`
- **plan** (enum: 'free' | 'plus', 기본값 'free'): 플랜 구분

**인덱스:**

- `users_pkey` (id) - 기본키

**RLS**: 모두 읽기 가능, 본인 행에 한해 INSERT/UPDATE 허용

### contact

문의/제휴/지원/피드백 등 외부 접점 수집

- **id** (bigint, identity, PK): 자동 증가 ID
- **inquiry_type** (enum: general|partnership|support|feedback, 기본값 'general'): 문의 유형 분류
- **email** (text, 이메일 정규식 체크): 회신 주소 검증
- **message** (text, length 10–2000): 문의 내용
- **user_id** (UUID, FK → users.id, NULL 허용): 비로그인 제출 지원
- **created_at** (timestamptz): 생성 시각, 기본값 `now()`
- **updated_at** (timestamptz): 수정 시각, 기본값 `now()`

**인덱스:**

- `contact_pkey` (id) - 기본키
- `idx_contact_type` (inquiry_type) - 문의 유형별 조회
- `idx_contact_user_id` (user_id) - 사용자별 조회
- `idx_contact_created_at` (created_at DESC) - 생성일 기반 정렬

**RLS**: 누구나 INSERT 가능, 본인(user_id) 또는 비로그인(NULL) 레코드 SELECT 가능

---

## 뷰 및 Materialized Views

### tool_ratings

도구별 리뷰 통계 뷰

```sql
SELECT tool_id,
    count(rating) AS review_count,
    round(avg((rating)::numeric), 1) AS average_rating
FROM reviews
GROUP BY tool_id;
```

---

## 데이터베이스 함수

### 핵심 검색 함수

#### `match_tools(query_embedding vector, match_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 10)`

벡터 유사도 기반 도구 검색 함수

**반환값**: 도구 정보 + 유사도 점수
**사용처**: LangChain 호환 벡터 검색

#### `hybrid_search_tools(query_text text, query_embedding text, match_count integer DEFAULT 3, vector_weight numeric DEFAULT 0.7, text_weight numeric DEFAULT 0.3)`

벡터 + 텍스트 가중 혼합 검색 함수

**반환값**: 도구 정보 + 하이브리드 점수
**특징**: 벡터 유사도와 텍스트 유사도를 가중치로 결합

#### `hybrid_search_tools(query_text text, query_embedding vector, match_count integer DEFAULT 10, vector_weight double precision DEFAULT 0.7, text_weight double precision DEFAULT 0.3)`

벡터 타입을 직접 받는 하이브리드 검색 함수

**반환값**: 도구 정보 + 결합 점수
**특징**: 벡터, 텍스트, 카테고리, 도메인 유사도를 종합적으로 계산

### 유틸리티 함수

#### `check_vector_index_performance()`

임베딩 인덱스 사용량 점검 함수

**반환값**: 인덱스별 통계 정보 (스캔 횟수, 읽은 튜플 수 등)

#### `check_rls_performance()`

RLS 정책 성능 점검 함수

**반환값**: RLS 정책별 최적화 상태

#### `cleanup_expired_cache()`

만료된 가이드 및 캐시 자동 정리 함수

**반환값**: 삭제된 항목 수
**정리 대상**: tool_guides.expires_at, search_cache.expires_at

#### `cleanup_expired_entries()`

만료된 항목 정리 및 구체화 뷰 새로고침 함수

**특징**: tool_stats 구체화 뷰 자동 새로고침

#### `refresh_tool_stats()`

도구 통계 구체화 뷰 새로고침 함수

---

## 트리거

### `handle_new_user()`

신규 사용자 가입 시 자동 프로필 생성 트리거

**동작**: auth.users에 새 사용자 생성 시 public.users에 자동 프로필 생성

### `update_updated_at_column()`

테이블 수정 시 updated_at 자동 갱신 트리거 함수

**적용 테이블**: 모든 테이블의 updated_at 컬럼

---

## 확장 프로그램

### 핵심 확장

- **vector (0.8.0)**: pgvector 임베딩 검색 (IVFFLAT, HNSW 인덱스 지원)
- **pg_trgm (1.6)**: 텍스트 유사도 검색 (trigram 기반)
- **uuid-ossp (1.1)**: UUID 생성 함수
- **pgcrypto (1.3)**: 암호화 함수

### 성능 모니터링

- **pg_stat_statements (1.11)**: SQL 실행 통계 추적
- **pg_stat_monitor (2.1)**: PostgreSQL 쿼리 성능 모니터링

### 추가 기능

- **pg_graphql (1.5.11)**: GraphQL 지원
- **supabase_vault (0.3.1)**: Supabase 보안 저장소
- **pg_net (0.14.0)**: 비동기 HTTP
- **pg_cron (1.6)**: PostgreSQL 작업 스케줄러

---

## 인덱스 전략

### 벡터 검색 최적화

- **IVFFLAT 인덱스**: `idx_tools_embedding_optimized` (lists=10으로 소규모 데이터셋 최적화)
- **벡터 연산자**: `<=>` (cosine distance), `<->` (L2 distance)

### 텍스트 검색 최적화

- **GIN + trigram**: `idx_tools_name_gin`, `idx_tools_description_gin`
- **GIN 배열**: `idx_tools_categories` (카테고리 배열 검색)

### 성능 최적화

- **Partial 인덱스**: `is_active = true` 조건으로 활성 도구만 인덱싱
- **복합 인덱스**: (tool_id, task_context), (user_id, tool_id) 등
- **정렬 최적화**: created_at DESC 인덱스로 최신 항목 우선 조회

---

## 보안 및 RLS 정책

### 공용 읽기 허용

- `tools`: 모든 도구 정보 공개
- `tool_guides`: 모든 가이드 공개
- `reviews`: 모든 리뷰 공개
- `users`: 모든 사용자 프로필 공개

### 제한 쓰기

- **service_role**: 모든 테이블 관리 가능
- **authenticated**: 본인 데이터만 생성/수정
- **anon**: contact 테이블만 INSERT 가능

### 사용자 데이터 보호

- `bookmarks`: 본인 북마크만 CRUD
- `reviews`: 본인 리뷰만 수정/삭제
- `users`: 본인 프로필만 수정

---

## 최근 마이그레이션

### 2025년 8월 17일

1. **fix_foreign_keys_and_references**: 외래키 및 참조 관계 수정
2. **optimize_rls_performance_safe**: RLS 성능 최적화
3. **remove_duplicate_policies**: 중복 정책 제거
4. **add_performance_indexes_fixed**: 성능 인덱스 추가
5. **add_data_integrity_constraints_fixed**: 데이터 무결성 제약 추가
6. **create_materialized_views**: 구체화 뷰 생성

---

## 프런트엔드 사용 포인트

### 도구 추천 시스템

- **검색 백엔드**: `match_tools`/`hybrid_search_tools` → 후보 도구 ID → 상세 스코어링
- **가중치**: bench_score, cost_index, domains 기반 최종 순위 결정

### 가이드 시스템

- **TaskCard "상세 가이드"**: GuideModal → `/api/tools/[id]/guide`
- **가이드 데이터**: `guide_content.summary`, `guide_content.sections[]`, `source_urls`, `confidence_score`

### 사용자 기능

- **북마크**: 도구 카드 북마크 토글 (`bookmarks` 테이블)
- **리뷰**: 도구 상세 페이지 리뷰 작성 (`reviews` 테이블)
- **통계**: `tool_ratings` 뷰로 도구별 평점 표시

---

## 성능 모니터링

### 정기 점검 함수

- `check_vector_index_performance()`: 벡터 인덱스 사용량 확인
- `check_rls_performance()`: RLS 정책 최적화 상태 확인

### 자동 정리

- `cleanup_expired_cache()`: 만료된 가이드 및 캐시 자동 삭제
- `cleanup_expired_entries()`: 만료 항목 정리 및 통계 뷰 새로고침

---

## 향후 개선 제안

### 성능 최적화

- **벡터 인덱스 튜닝**: 데이터 증가에 따른 IVFFLAT 파라미터 조정
- **구체화 뷰 전략**: 자주 조회되는 복합 데이터의 구체화 뷰 확장
- **인덱스 분석**: `pg_stat_user_indexes` 기반 인덱스 사용량 분석

### 기능 확장

- **다국어 지원**: 언어별 전용 임베딩 모델 및 인덱스
- **사용자 개인화**: 북마크/리뷰 히스토리 기반 맞춤형 추천
- **가이드 품질 관리**: 사용자 평가 시스템 및 자동 품질 개선

### 모니터링 강화

- **성능 메트릭**: 가이드 생성 시간, 캐시 히트율, API 비용 추적
- **정기 정리**: `cleanup_expired_cache()` 크론잡 스케줄링
- **알림 시스템**: 성능 저하 시 자동 알림
