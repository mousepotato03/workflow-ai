### **Workflow AI - Design Guidelines v1.0**

**1. Core Design Philosophy**

- **Clarity & Focus: ** Users should be able to enter 'goals' and focus only on the core journey of getting 'results'. Minimize unnecessary decorations.
- **Modern & Tech (modern and technological sensibility): ** Feels sophisticated and refined like an AI service. Use soft colors and rounded corners to avoid being too cold.
- **Intuitive & Guiding:** Clarify the visual hierarchy and guidance devices so that users know naturally what to do next.

**2. Color Palette**

It is based on a dark background (dark mode first) to give the AI service a reliable and technical feel, and uses point colors that highlight key actions.

- **Background:**:
  - 'bg-background' (basic): very dark gray ('#0A0A0A0A' or 'slate-950')
  - 'bg-muted' (auxiliary): gray that is one tone brighter than basic ('#1A1A1A1A' or 'slate-900') - card, input window background, etc
- **Text:**:
  - 'text-foreground' (basic): light gray, almost white ('#F2F2F2' or 'slate-50')
  - 'text-muted-foreground' (auxiliary): middle tone gray ('#A1A1A1' or 'slate-400') - supplementary explanation, meta information, etc
- **Primary Color:**:
  - 'bg-primary' (button, highlight): **Vibrant Purple** or **Electric Blue**. It gives a technical and futuristic look. ('#6D28D9' or '#2563EB')
  - 'text-primary': same as above
- **Emphasis/Notice (Accent Color):**:
  - 'accent': bright colors in complementary or similar colors (e.g. 'Teal' or 'Pink') - badge, special notification, etc
- **Colors by function:**:
  - **Upvote:** Green ('#10B981' / 'emerald-500')
  - **Downvote: ** Red color ('#EF4444' / 'red-500')

**3. Typography**

Using modern sans-serif fonts, with readability as the top priority. (Use Next.js/font)

- **Basic font:** 'Inter' or 'Pretendard' (consider Korean)
- **Headings - h1, h2, h3):**:
  - 'font-bold', 'tracking-tight' (a little narrow)
  - h1 (page title): 'text-4xl'
  - h2 (Section title): 'text-2xl'
  - h3 (card title): 'text-lg'
- **Body:**:
  - `font-normal`, `text-base` (16px)
  - 'Leading-relaxed' (to secure readability by widening the line)
- **Additional information (Muted Text):**:
  - `text-sm` (14px), `text-muted-foreground`

**4. Layout and component design**

#### **4.1. Main page (AI workflow recommendation)**

- **Objective:** Immediately direct the user's gaze to the central input window.
- **Structure:**:
  1. **Header:**:
     - Left: 'Workflow AI' logo (text or icon + text)
     - Center: (empty)
     - Right: 'Explore' link button, 'GitHub' link icon button
  2. **Central content (Hero Section):**:
     - **메인 헤드라인 (h1):** `Describe your goal, we design the workflow.`
     - **서브 헤드라인:** `AI-powered tool recommendations to get your work done faster.`
     - **Input form:**:
       - `Textarea`: `bg-muted`, `border-slate-800`, `focus:border-primary`. placeholder 텍스트로 사용 예시를 보여줌 (예: "Create a marketing blog post for a new product launch...")
       - `Button`: `bg-primary`, `text-primary-foreground`. "Get Workflow"
  3. **Results display area:**:
     - It appears dynamically under the input form.
     - 'Border-t border-slate-800' distinguished from the top.
