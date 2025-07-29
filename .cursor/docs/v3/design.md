### **3. Contact 페이지 디자인 가이드라인**

- **목표:** 사용자가 자신의 목적에 맞는 문의를 쉽고 명확하게 제출할 수 있도록 한다.
- **페이지 레이아웃:**
    - **헤더(h1):** `Contact Us`
    - **설명(p):** `Have a question, a bug to report, or a partnership inquiry? We'd love to hear from you.`
    - **폼 영역:** 페이지 중앙에 `Card` 컴포넌트로 감싸진 폼을 배치하여 시각적으로 집중시킨다.
- **폼 필드 디자인:**
    1. **문의 유형 (Inquiry Type):**
        - `shadcn/ui`의 `Select` 컴포넌트를 사용.
        - "What can we help you with?"라는 레이블을 사용.
        - 옵션: `General Question`, `Bug Report`, `Feature Suggestion`, `Partnership / Listing Request`
    2. **이메일 주소 (Your Email):**
        - `Input` 컴포넌트.
    3. **제목 (Subject):**
        - `Input` 컴포넌트.
    4. **내용 (Message):**
        - `Textarea` 컴포넌트. 충분한 높이(예: `rows={6}`)를 제공.
    5. **제출 버튼:**
        - `Button` 컴포넌트, `bg-primary` 색상. "Send Message"
- **상호작용:**
    - 버튼 클릭 시 로딩 상태를 표시하고, 성공/실패 여부를 명확한 피드백(Toast 메시지)으로 알려준다.