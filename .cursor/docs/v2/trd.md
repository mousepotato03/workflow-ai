**1. 시스템 개요 (System Overview)**
*   **1.1. 목표:** 사용자의 자연어 입력을 받아 최적의 AI/웹 도구 워크플로우를 추천하고, 사용자들이 도구에 대한 정보를 탐색하고 의견을 공유할 수 있는 커뮤니티 기능을 제공한다.
**2. 데이터베이스 스키마 및 ERD (Supabase)**

*   **2.1. ERD (Entity-Relationship Diagram):**
    ```mermaid
    erDiagram
        users { UUID id PK; TEXT full_name; TEXT avatar_url }
        tools { UUID id PK; TEXT name; TEXT description; VECTOR(768) embedding }
        tool_interactions { BIGINT id PK; UUID user_id FK; UUID tool_id FK; SMALLINT interaction_type }
        reviews { BIGINT id PK; UUID user_id FK; UUID tool_id FK; TEXT content }
        inquiries { BIGINT id PK; inquiry_type type; TEXT email; TEXT message; UUID user_id FK }
    
        users ||--o{ tool_interactions : "has"
        tools ||--o{ tool_interactions : "has"
        users ||--o{ reviews : "writes"
        tools ||--o{ reviews : "has"
        users ||--o{ inquiries : "submits"
    ```
*   **2.2. 테이블 상세 정의:**
    *   **`users`:** 사용자 프로필 정보. `auth.users` 테이블과 1:1 관계.
    *   **`tools`:** AI/웹 도구 정보. `embedding` 컬럼은 Google `text-embedding-004` 모델의 768차원 벡터를 저장.
    *   **`tool_interactions`:** 사용자의 도구 좋아요/싫어요 기록.
    *   **`reviews`:** 사용자의 도구 리뷰.
    *   **`inquiries`:** 사용자 및 파트너의 모든 문의. `inquiry_type` ENUM으로 종류 구분.
    *   *각 테이블에는 앞서 정의한 RLS(Row Level Security) 정책이 적용됩니다.*

**3. 인증 흐름 (Authentication Flow)**

1.  **시작:** 클라이언트에서 `supabase.auth.signInWithOAuth({ provider: 'google' })` 호출.
2.  **콜백:** Google 인증 후 `/auth/callback`으로 리디렉션.
3.  **세션 생성:** `/auth/callback/route.ts`에서 `supabase.auth.exchangeCodeForSession(code)`을 실행하여 세션 쿠키 생성.
4.  **프로필 동기화:** 위 콜백 핸들러에서 최초 로그인 사용자인지 확인 후, `users` 테이블에 프로필 정보를 INSERT.
5.  **상태 유지:** 안전한 `httpOnly` 쿠키를 통해 서버/클라이언트 양단에서 인증 상태 유지.
6.  **로그아웃:** `supabase.auth.signOut()` 호출.

**4. API 엔드포인트 명세**

| HTTP Method | Endpoint | 설명 | 접근 제어 |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/workflow` | 사용자의 목표를 받아 워크플로우를 생성 | **로그인 필수** |
| `POST` | `/api/tools/{tool_id}/interact` | 도구에 대한 좋아요/싫어요 기록 | **로그인 필수** |
| `POST` | `/api/tools/{tool_id}/reviews` | 특정 도구에 대한 리뷰 작성 | **로그인 필수** |
| `PUT` | `/api/reviews/{review_id}` | 자신의 리뷰 수정 | **로그인 필수** |
| `DELETE` | `/api/reviews/{review_id}` | 자신의 리뷰 삭제 | **로그인 필수** |
| `POST` | `/api/contact` | Contact 폼 문의 제출 | **모두 허용** |

*   **API 보안:** 모든 로그인 필수 API는 라우트 핸들러 시작점에서 `supabase.auth.getUser()`를 통해 사용자 세션을 확인하며, 401 Unauthorized로 응답하여 비인증 접근을 차단한다.

**5. 프론트엔드 구현 계획**

*   **5.1. 페이지 구조:**
    *   `/` (Home): 메인 페이지, 워크플로우 추천 기능.
    *   `/explore`: AI 도구 탐색 페이지 (그리드 뷰, 필터, 정렬).
    *   `/contact`: 문의 제출 페이지.
    *   `/login`: 로그인이 필요할 때 보여주는 페이지. Google 로그인 버튼만 존재.
    *   `/auth/callback`: 인증 콜백 처리를 위한 서버 라우트. UI 없음.

*   **5.2. 핵심 컴포넌트:**
    *   **`WorkflowInputForm.tsx` & `WorkflowResultDisplay.tsx`**: 워크플로우 추천 기능 UI.
    *   **`ToolGrid.tsx` & `ToolCard.tsx`**: 둘러보기 페이지의 도구 그리드.
    *   **`ToolDetailModal.tsx`**: 도구 상세 정보 및 리뷰를 보여주는 모달.
    *   **`ContactForm.tsx`**: 문의 제출 폼.
    *   **`LoginButton.tsx`**: 헤더에 위치. 로그인 상태에 따라 'Login' 버튼 또는 `UserProfileDropdown` 표시.
    *   **`UserProfileDropdown.tsx`**: 로그인된 사용자 아바타와 'Logout' 메뉴.

*   **5.3. 상태 관리 및 데이터 페칭:**
    *   **인증 상태:** `@supabase/auth-helpers-nextjs`를 사용하여 전역적인 사용자 세션 관리.
    *   **서버 상태:** TanStack Query (`useQuery`, `useMutation`)를 사용하여 API 데이터 페칭 및 서버 상태 관리 (로딩, 에러, 캐싱 등).
    *   **클라이언트 상태:** `Zustand`를 사용하여 모달의 열림/닫힘 상태 등 간단한 UI 상태 관리.

*   **5.4. 기능 접근 제어 (UI 레벨):**
    *   **게스트 허용:** 둘러보기 페이지, Contact 페이지, 도구/리뷰 정보 읽기.
    *   **로그인 필요:**
        *   메인 페이지의 워크플로우 추천 기능 접근 시, 로그인하지 않았다면 `/login` 페이지로 리디렉션.
        *   '좋아요', '리뷰 작성' 등 로그인 필수 버튼 클릭 시, 로그인하지 않았다면 로그인 유도 모달 표시 또는 `/login` 페이지로 리디렉션.

**6. 비기능적 요구사항**

*   **6.1. 성능:**
    *   API 응답 시간은 평균 5초 이내를 목표로 한다 (LLM 호출 포함).
    *   Next.js의 서버 컴포넌트와 캐싱 전략을 적극 활용하여 초기 로딩 속도(LCP)를 최적화한다.
*   **6.2. 보안:**
    *   모든 사용자 입력은 Zod로 검증한다.
    *   모든 DB 접근은 Supabase RLS 정책에 의해 보호된다.
    *   API 레벨에서 추가적인 인증 검사를 수행하여 이중으로 보호한다.
*   **6.3. 개발:**
    *   `utils/supabase/` 폴더에 `server.ts`, `client.ts`를 두어 Supabase 클라이언트 인스턴스를 용도에 맞게 분리하여 사용한다.