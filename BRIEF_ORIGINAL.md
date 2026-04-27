# BRIEF — 원본 디자인 브리프

> 코치 장호준이 제공한 원본 브리프. 디자인 작업의 출발점.

---

## Product
- **Name**: TRAINORACLE (확정 — 작업 중 결정)
- **Type**: AI coaching platform
- **Core Method**: Coach Jang's training philosophy embedded as 9.5‑day cycle plans
- **Target**: Elite athletes and coaches

## Elevator Pitch
> "{PRODUCT_NAME} is the **thinking tool**. Strava records, TrainingPeaks analyzes, TRAINORACLE delivers **why-based** training guidance."

## Design Keywords
**Scientific Minimalism** — Precise, Quiet, Trustworthy, Elite, Honest

## Target Users
| Persona | Demographics | Role |
|---|---|---|
| **Persona 1** | Elite runner, 24 y | 1500m / 5000m specialist |
| **Persona 2** | Coach, 38 y | Manages 8 athletes |
| **Persona 3** | Product owner / coach | Coach Jang himself |

## Usage Contexts
- Outdoor track
- Post‑training at home
- Competition venues
- Office (coach desktop)
- Transit (mobile, coach quick check)

**Required**: Large touch targets, high‑contrast mode, one‑thumb operable, dark mode.

---

## 10 Design Rules

1. **Mobile-first** (360px baseline)
2. **Scientific, not sporty**
3. **Data‑dense yet breathable**
4. **Evidence-first** with "why?" links
5. **Honest uncertainty**
6. **One‑thumb operable**
7. **Pro‑tools speed**
8. **Preserve terminology** (CK, EPOC, TSS, etc. — keep English)
9. **Three calendar views** (Week / 9.5-Cycle / Timeline)
10. **Silence over noise**

---

## Visual Identity

### Color Palettes
- Light + Dark modes required
- Primary accent: `#0F766E` (or alternatives) — Deep Teal
- Semantic status: ok / warn / err / info / unc
- Energy systems: BASE, LT, VO2, GLY, ATP-PC, REST

### Typography
- **Inter** for UI body
- **JetBrains Mono / IBM Plex Mono** for numbers / code
- **Pretendard Variable** for Korean
- Defined type scale required

### Layout
- 8-point grid
- Defined spacing
- Border-radius scale
- Minimal elevation (shadows minimal)
- **Lucide icons only** (no other icon families)
- Limited illustration

---

## Information Architecture

### Public pages
- Landing
- Philosophy
- References
- Glossary
- About
- Demo
- Sign-in

### Authenticated area
- Onboarding
- Dashboard
- Calendar
- Session detail
- Analysis
- Athletes (coach view)
- Chat (장호준 AI)
- Inbox (AI suggestions)
- Competitions
- Reports
- Settings
- Knowledge

---

## Core Screens (12)

1. Landing
2. Onboarding
3. Dashboard Home
4. Training Calendar (3 views)
5. Session Detail
6. AI Chat
7. Analysis Dashboard
8. AI Inbox
9. Daily Check‑in
10. Competition Management
11. Philosophy page
12. Settings

---

## Component Library (~45 components)

Buttons, inputs, selects, badges, tags, tooltips, modals, cards, tables, charts (donut, line, bar), calendar grids, navigation tabs/sidebars, etc.

---

## Interaction / Motion

- Durations: **150–500 ms**
- Easing: **cubic-bezier**
- ❌ No bounce / particle effects

---

## Accessibility

- **WCAG 2.1 AA+**
- Contrast ≥ 4.5:1
- **44 × 44 px** minimum touch targets
- Dark-mode toggle
- High-contrast mode

---

## Content Tone

- Formal Korean / English bilingual
- Evidence-based statements
- Precise numeric notation
- Avoid speculative language

---

## Deliverables

### Phase 1 (this engagement)
- Figma file
- Design system docs
- Component library

### Phase 2
- Low-fi wireframes (12 screens)
- Hi-fi mockups (light/dark, mobile/desktop)
- Interaction prototypes

### Phase 3
- Handoff specs
- Responsive guide

---

## Constraints (DO NOT)

- ❌ No stock fitness photos
- ❌ No neon gradients
- ❌ No gamification
- ❌ No social feeds
- ❌ No ads
- ❌ No excessive pop‑ups
- ❌ No medical advice without disclaimer
- ❌ Avoid speculative language

---

## Timeline

7-week schedule from moodboard to dev handoff with weekly reviews.

---

## Communication

- **Final approver**: Coach Jang (Product owner)
- **Feedback channels**: Figma comments, Kakao/Slack chat

---

## Notes from design process

> 작업 중 사용자(코치 장호준)의 추가 결정사항:
>
> 1. **언어**: 한국어 위주, 단 훈련 용어는 영어 유지
> 2. **디자인 톤 변경 (중요)**: 초기 v1의 "카드 박스 + 둥근 모서리 + 좌측 컬러 스트립 + Serif 폰트" 스타일 거부 → v2 "Tufte × Linear" 재작업
> 3. **에너지 시스템 컬러**: 파스텔 배경 박스 → 점·코드·underline으로 변경
> 4. **Serif 폰트**: UI에서 완전 제거
> 5. **AI Chat 비용**: 베타에서는 mock 데이터, 출시 후 Claude API 권장
> 6. **개발 핸드오프 우선** — 디자인 산출물 + 문서를 GitHub-ready 패키지로 묶어 다른 AI 에이전트에게 전달
