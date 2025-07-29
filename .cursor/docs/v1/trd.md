**1. 시스템 개요 (System Overview)**

- **1.1. 목표:** 사용자의 자연어 입력을 받아, 이를 수행하기 위한 작업 단계와 최적의 도구를 추천하는 워크플로우 생성 기능을 제공한다.
- **1.2. 핵심 아키텍처:**
    - **프레임워크:** Next.js 15 (App Router)
    - **UI:** Tailwind CSS, shadcn/ui
    - **상태 관리:** Zustand (클라이언트 상태), TanStack Query (서버 상태)
    - **백엔드 로직:** Next.js API Routes (Serverless Functions)
    - **데이터베이스:** Supabase (PostgreSQL + pgvector)
    - **AI Orchestration:** LangChain.js
    - **LLM API:** **Google AI (Gemini 2.5 Pro)**
    - **배포:** Vercel
- **1.3. 데이터 흐름 (High-level Data Flow):**
    1. **Client (Browser):** 사용자가 목표(`goal`)를 입력하고 '추천받기' 버튼을 클릭한다. 클라이언트 단에서 입력 텍스트의 언어(`language`)를 감지한다.
    2. **Next.js API Route (`/api/workflow`):**
    a. 입력된 `goal`과 `language`를 받아 **`Task Decomposer` Chain** (LangChain.js + Gemini 2.5 Pro)에 전달하여 `tasks`(작업 목록)를 생성한다.
    b. 생성된 각 `task`를 **`Tool Recommender` Chain**에 순차적으로 전달한다.
    c. `Tool Recommender`는 Supabase pgvector에서 `task`와 가장 유사한 도구 문서를 RAG(Retrieval-Augmented Generation) 방식으로 검색한다.
    d. 검색된 도구 정보, `task`, `language`를 Gemini 2.5 Pro에 전달하여 최종 추천 도구와 추천 이유(`recommendation`)를 생성한다.
    3. **Client (Browser):** API로부터 받은 `tasks`와 `recommendations`를 UI에 렌더링한다.

**2. 데이터베이스 스키마 (Supabase)**

- **2.1. `tools` 테이블:** 서비스에서 추천할 도구 정보를 저장한다. `pgvector` 익스텐션 활성화가 필수적이다.
    
    ```sql
    -- tools 테이블 생성
    CREATE TABLE tools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT now(),
        name TEXT NOT NULL UNIQUE,          -- 도구 이름 (예: DeepL)
        description TEXT,                   -- 한 문장 설명
        url TEXT,                           -- 공식 웹사이트 URL
        logo_url TEXT,                      -- 로고 이미지 URL
        categories TEXT[],                  -- 카테고리 (예: {'번역', '유틸리티'})
        pros TEXT[],                        -- 장점 목록
        cons TEXT[],                        -- 단점 목록
        embedding_text TEXT,                -- RAG 검색을 위한 임베딩 대상 텍스트
        recommendation_tip TEXT,            -- LLM이 추천 이유를 생성할 때 참고할 팁
        embedding VECTOR(768)               -- Google 'text-embedding-004' 모델의 벡터 차원
    );
    
    -- pgvector 유사도 검색을 위한 인덱스 생성
    CREATE INDEX ON tools USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    
    ```
    
- **2.2. 데이터베이스 함수 (Supabase Edge Function):**
    - `tools` 테이블에 새로운 데이터가 추가(INSERT)되거나 `embedding_text`가 수정(UPDATE)될 때, 자동으로 `embedding` 벡터를 생성/업데이트하는 트리거 함수를 구현한다.
        1. **Function Name:** `create_embedding_on_tool_change`
        2. **Trigger:** `tools` 테이블의 `INSERT` 또는 `UPDATE` 시 실행
        3. **Logic:**
        a. 변경된 row의 `embedding_text` 필드 값을 가져온다.
        b. Google AI Embeddings API (`text-embedding-004`)를 호출하여 텍스트를 768차원의 벡터로 변환한다.
        c. 해당 row의 `embedding` 컬럼에 생성된 벡터값을 업데이트한다.

**3. API 엔드포인트 명세**

- **3.1. `POST /api/workflow`**
    - **설명:** 사용자의 목표를 받아 워크플로우(작업 목록 및 추천 도구)를 생성하여 반환한다.
    - **요청 본문 (Request Body):**
        
        ```tsx
        // Zod 스키마
        import { z } from 'zod';
        
        export const workflowRequestSchema = z.object({
          goal: z.string().min(10, '목표는 10자 이상 입력해주세요.').max(200, '목표는 200자 이내로 입력해주세요.'),
          language: z.string().min(2).max(10), // 감지된 언어 코드 (예: 'ko', 'en')
        });
        
        ```
        
    - **성공 응답 (Response Body - 200 OK):**
        
        ```tsx
        export interface WorkflowResponse {
          tasks: {
            taskName: string; // 분해된 작업 이름
            recommendedTool: {
              id: string;
              name: string;
              logo_url: string;
              url: string;
            } | null; // 추천된 도구 정보 (못 찾으면 null)
            recommendationReason: string; // 추천 이유
          }[];
        }
        
        ```
        
    - **에러 응답 (Error Response):**
        - `400 Bad Request`: Zod 스키마 검증 실패 시
        - `500 Internal Server Error`: Google AI API 또는 Supabase 오류 발생 시

**4. 핵심 로직 구현 (LangChain.js)**

- **4.1. 환경 설정:**
    - `.env.local` 파일에 `GOOGLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` 환경 변수를 설정한다.
    - 필요 패키지: `langchain`, `@langchain/google-genai`, `@langchain/community`, `zod`, `franc`.
- **4.2. Chain 1: `TaskDecomposerChain`**
    - **Input:** `{goal: string, language: string}`
    - **Prompt (English System Prompt):**
        
        ```
        You are a highly-skilled project manager. Your task is to break down a user's goal into a list of 2-5 concrete, actionable sub-tasks.
        The output MUST be a JSON object with a key "tasks", which contains an array of strings.
        IMPORTANT: You MUST respond in the same language as the user's input. The user's goal is provided below in the language: {language}.
        
        ```
        
    - **LLM:** `ChatGoogleGenerativeAI (model: "gemini-2.5-pro-latest", temperature: 0)`
    - **Output Parser:** `JsonOutputParser`를 사용하여 LLM 응답을 `{tasks: string[]}` 형태로 파싱한다.
- **4.3. Chain 2: `ToolRecommenderChain`**
    - **Input:** `{task: string, context: Document[], language: string}`
    - **Retriever:** `SupabaseVectorStore`를 사용하여 DB를 초기화하고, `.asRetriever({k: 3})`를 통해 유사도 상위 3개 도구의 `embedding_text`와 메타데이터를 가져오는 검색기를 생성한다.
    - **Prompt (English System Prompt):**
        
        ```
        You are an expert on AI tools. Your job is to recommend the single best tool to accomplish a given 'task', based on the provided 'context'.
        Explain WHY this tool is the best choice for the task.
        If no tool in the context is suitable, respond with "No suitable tool found."
        IMPORTANT: You MUST respond in the same language as the user's original goal. The language is: {language}.
        
        ```
        
    - **LLM:** `ChatGoogleGenerativeAI (model: "gemini-2.5-pro-latest", temperature: 0)`
    - **Output:** LLM이 생성한 추천 도구 이름과 이유 텍스트.

**5. 프론트엔드 구현 계획**

- **5.1. 컴포넌트 구조:**
    - `page.tsx`: 메인 페이지. `WorkflowInputForm`과 `WorkflowResultDisplay` 컴포넌트를 포함한다.
    - `WorkflowInputForm.tsx`: 사용자가 목표를 입력하는 `form` 요소. `react-hook-form`과 `zod`로 입력값 관리 및 검증. TanStack Query의 `useMutation`을 사용하여 `/api/workflow` API를 호출한다.
    - `WorkflowResultDisplay.tsx`: API 응답 결과를 받아 작업 및 추천 도구 목록을 렌더링. 로딩 상태, 에러 상태를 처리한다.
    - `TaskCard.tsx`: 개별 작업과 추천 도구 정보를 보여주는 카드 UI 컴포넌트.
- **5.2. 상태 관리:**
    - **서버 상태:** TanStack Query가 API 요청의 `isLoading`, `isError`, `data` 상태를 모두 관리한다.
    - **클라이언트 상태:** UI 전역적으로 필요한 상태(예: 테마 설정)가 발생할 경우에만 `Zustand`를 사용한다. MVP 단계에서는 불필요할 가능성이 높다.
- **5.3. 사용자 언어 감지:**
    - `WorkflowInputForm.tsx`에서 API를 호출하기 전에, 사용자가 입력한 텍스트의 언어를 감지한다.
    - **구현:** 경량 라이브러리인 `franc`를 사용하여 언어 코드를 식별하고(예: `kor` -> `ko` 변환 처리), 이를 API 요청 본문의 `language` 필드에 담아 전송한다.

**6. 비기능적 요구사항 (Non-functional Requirements)**

- **6.1. 성능:** API 응답 시간은 평균 5초 이내를 목표로 한다. 이는 외부 LLM API 호출 시간을 포함한 수치이다.
- **6.2. 보안:** 모든 사용자 입력은 프론트엔드(Zod)와 백엔드 양단에서 검증한다. 향후 사용자 데이터 확장을 대비하여 Supabase의 RLS(Row Level Security) 정책을 기본적으로 활성화한다.
- **6.3. 에러 핸들링:** API 호출 실패, LLM 응답 파싱 실패, DB 오류 등 예상 가능한 모든 에러 케이스에 대해 사용자에게 친화적인 메시지를 노출하고, 서버에는 구체적인 에러 로그를 기록한다.