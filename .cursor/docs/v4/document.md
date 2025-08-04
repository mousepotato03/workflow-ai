## 1. Project Overview

This document outlines the design for an AI-powered system that recommends optimal workflows. Users describe goals in natural language, and the system decomposes the task, matches sub-tasks with the best AI tools, and provides execution guides.

### 1.1. Core Features

- **Natural Language Task Input**: Users submit tasks in plain text.
- **Smart Task Decomposition**: AI breaks down tasks into 2-5 actionable sub-tasks.
- **AI Tool Matching**: Recommends optimal AI models (ChatGPT, Claude) or web services (Gamma, NotebookLM).
- **Execution Guidelines**: Provides step-by-step instructions for using recommended tools.
- **Knowledge-Based Recommendations**: Uses a RAG pattern (Supabase Vector DB + Web Search) for high accuracy.

### 1.2. Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI/UX**: Tailwind CSS, shadcn/ui, Radix UI, Framer Motion
- **Auth & DB**: Supabase (Auth, PostgreSQL, pgvector)
- **AI/Backend**: LangChain.js, Next.js API Routes
- **Deployment**: Vercel

---

## 2. System Architecture

### 2.1. System Layers

- **Frontend Layer (Next.js 15)**

  - Task Input & Real-time Progress UI
  - Workflow Result & Guideline Display
  - User History & Favorites Management

- **API Layer (Next.js API Routes)**

  - `/api/workflow`: 통합 워크플로우 처리 (작업 분해 + 도구 추천)
  - `/api/feedback`: 워크플로우 피드백 수집
  - `/api/tools/[tool_id]/interact`: 도구 상호작용 (좋아요/싫어요)
  - `/api/tools/[tool_id]/reviews`: 도구 리뷰 관리
  - `/api/contact`: 문의사항 처리
  - `/api/reviews/[review_id]`: 리뷰 상세 관리

- **Business Logic Layer (LangChain.js)**

  - Task Decomposition Chain
  - Tool Matching Chain
  - Guide Generation Chain
  - RAG Chain (Knowledge Retrieval)

- **Data Layer (Supabase PostgreSQL + pgvector)**
  - **Core System**: workflows, tasks, tools, recommendations
  - **User Management**: users, user_preferences, tool_interactions  
  - **Review System**: reviews, feedback, recommendation_feedback
  - **AI Enhancement**: ai_models, task_patterns, knowledge_base
  - **Analytics**: search_analytics, tool_relationships
  - **Support**: inquiries

### 2.2. Data Flow

`User Input` → `Pre-processing` → `Task Decomposition` → `Vector Search` → `Tool Matching` → `Guide Generation` → `Display Results`

### 2.3. API Endpoint Examples

**Workflow API (통합 처리)**

```typescript
// POST /api/workflow
{
  "goal": "마케팅 전략 프레젠테이션 제작",
  "language": "ko"
}

// Response
{
  "workflowId": "uuid",
  "status": "completed",
  "tasks": [
    {
      "id": "task-1",
      "name": "시장 조사 및 데이터 수집",
      "order": 1,
      "recommendedTool": {
        "id": "tool-uuid",
        "name": "Claude",
        "logoUrl": "...",
        "url": "..."
      },
      "recommendationReason": "Claude는 시장 분석에 뛰어납니다...",
      "confidence": 0.8
    }
  ]
}
```

**Feedback API**

```typescript
// POST /api/feedback  
{
  "workflowId": "uuid",
  "rating": 4,
  "comment": "추천이 정확했습니다"
}

// Response
{
  "success": true,
  "message": "피드백이 성공적으로 저장되었습니다."
}
```

---

## 3. Vector DB Strategy

### 3.1. Database Schema (현재 구현)

```sql
-- 현재 구현된 주요 테이블들

-- 워크플로우 및 작업 관리
CREATE TABLE workflows (
  id UUID PRIMARY KEY,
  goal TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'ko',
  status VARCHAR(20) DEFAULT 'processing'
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL
);

-- 도구 및 추천 시스템
CREATE TABLE tools (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  metadata JSONB,
  embedding VECTOR(768), -- 현재 768차원 사용
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE recommendations (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools(id),
  reason TEXT,
  confidence_score FLOAT
);

-- 사용자 상호작용 및 피드백
CREATE TABLE feedback (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT
);

CREATE TABLE tool_interactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  tool_id UUID REFERENCES tools(id),
  interaction_type INTEGER -- -1: dislike, 1: like
);

-- 고급 기능 테이블들
CREATE TABLE ai_models (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  provider VARCHAR(50),
  capabilities JSONB,
  embedding VECTOR(768)
);

CREATE TABLE task_patterns (
  id UUID PRIMARY KEY,
  industry VARCHAR(100),
  pattern_type VARCHAR(50),
  description TEXT,
  embedding VECTOR(768)
);

-- 벡터 검색 최적화 인덱스
CREATE INDEX ON tools USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON knowledge_base USING hnsw (embedding vector_cosine_ops);
```

### 3.2. Data Management (현재 구현)

- **Embedding 생성**: 768차원 벡터 사용 (text-embedding-ada-002 모델 기준)
- **검색 전략**: 
  - **Hybrid Search**: 벡터 유사도 + 키워드 기반 풀텍스트 검색 결합
  - **다단계 검색**: 개인화 → 벡터 검색 → 키워드 폴백
  - **임계값 기반**: 피드백 데이터를 통한 최적 유사도 임계값 계산
- **성능 최적화**: 
  - HNSW 및 IVFFlat 인덱스 동시 활용
  - 카테고리별 테이블 분할 (table partitioning)
  - 머티리얼라이즈드 뷰를 통한 인기 조합 캐싱

---

## 4. Implementation Status (현재 상태)

### ✅ Phase 1: 기반 인프라 (완료)
- Supabase 스키마 및 데이터베이스 구축 완료
- LangChain 체인 구현 (`TaskDecompositionChain`, `ToolRecommenderChain`)
- 메인 워크플로우 API 및 UI 연결 완료

### ✅ Phase 2: 고급 기능 (완료)
- 벡터 DB 및 하이브리드 검색 시스템 구축
- 도구 매칭 알고리즘 (유사도 기반) 구현
- 사용자 피드백 및 상호작용 시스템 구축

### ✅ Phase 3: 최적화 및 확장 (대부분 완료)
- 성능 모니터링 및 분석 시스템 구축
- 사용자 피드백 시스템을 통한 추천 품질 개선
- ML 기반 개인화 추천 시스템 구현

### 🔄 현재 진행중/남은 작업
- 벡터 검색 기능 활성화 (현재 키워드 검색으로 폴백)
- 캐싱 시스템 구현 (Redis/Vercel KV)
- 프로덕션 배포 및 모니터링 설정

---

## 5. Performance & Security

### 5.1. Performance

- **Frontend**: Use `next/dynamic` for code-splitting heavy components and a lightweight state manager like Zustand.
- **Backend**: Stream API responses to improve perceived performance. Use composite indexes and materialized views in PostgreSQL for complex queries.

### 5.2. Security

- Encrypt all sensitive data and API keys at rest.
- Implement strict rate-limiting on public API endpoints.
- Use Supabase's Row Level Security (RLS) to ensure users can only access their own data.

---

## 6. Scalability & Future Roadmap

- **Architecture**: Design backend services in a modular way (e.g., `TaskAnalysisService`, `ToolRecommendationService`) to prepare for future migration to microservices.
- **AI Models**: Create a model management system to A/B test and seamlessly upgrade AI models.
- **Internationalization**: Structure the application to support multiple languages.

### 현재 추가 구현된 기능들

- **고급 사용자 경험**: 도구 좋아요/싫어요, 리뷰 시스템, 문의 기능
- **ML 기반 개선**: 추천 피드백 루프, 검색 분석, 개인화 알고리즘  
- **확장된 AI 시스템**: AI 모델 관리, 작업 패턴 라이브러리, 도구 관계성 매트릭스
- **성능 최적화**: 테이블 분할, 머티리얼라이즈드 뷰, 복합 인덱싱
- **분석 및 모니터링**: 사용자 행동 분석, 성능 메트릭, 품질 측정

### 다음 개발 우선순위
1. **벡터 검색 활성화**: 현재 비활성화된 벡터 검색 기능 복구
2. **캐싱 레이어**: API 응답 속도 개선을 위한 캐싱 구현  
3. **실시간 기능**: WebSocket 기반 실시간 진행상황 표시
4. **A/B 테스트**: 추천 알고리즘 성능 비교 시스템
