# Handoff: TRAINORACLE Design System & App

> **👋 처음 합류했다면 → `DECISION_LOG.md` 부터 읽으세요.**
> "왜 일지 형태로 출시하는가" 의 모든 근거가 거기 있습니다.
> 그 다음 `VARIANTS.md` → `NEGATIVE_SPACE.md` → 이 README.

## Overview

**TRAINORACLE** is an AI coaching platform for elite 1500m–10000m middle-distance runners. The product positions itself as a **"thinking tool"** — distinct from Strava (records) and TrainingPeaks (analyzes). It encodes coach 장호준's 30-year methodology — the **9.5-day cycle** — into an AI that explains every training decision with evidence, citations, and a confidence score.

This handoff covers:
- **Full design system** — tokens, typography, color, components, iconography
- **App UI Kit** — 5 core screens (Dashboard / Session Detail / Calendar / AI Chat / Inbox)
- **14 reference design HTMLs** from the original design sprint

The aesthetic is **"Scientific Minimalism — Tufte × Linear"**: hairline borders, square corners, color as information (never decoration), monospaced numerics, and honest AI uncertainty (every AI utterance carries a verdict + confidence + alternative view).

---

## ⚠ 방향 전환 — v2 (코치·AI 중심) → v3 (일지 중심, 모바일 우선)

**이 패키지의 메인은 이제 `ui_kits/trainoracle-app-v3/` 입니다.** v2 데스크탑 화면 5종 (`ui_kits/trainoracle-app/`) 은 **archive** 로 남겨두되, 새 제품 결정은 모두 v3 기준입니다.

### 결정 요약 (2026·06)
- **메인 = 일지** — AI 코칭 도구가 아니라 **"매일 손으로 쓰던 일지를, 프린트해서 가지고 싶게"** 만든다.
- **모바일 우선** — 데스크탑은 후순위. 7개 모바일 화면 (Home · LogEntry chooser · Post-session · Evening · Race pre/post · LogDetail · Trends) 이 코어.
- **AI 거의 안 보임** — Home에 1-2줄 인사이트, Tweaks 토글로 끄고 켜기. 메인은 **사용자가 쌓는 데이터**.
- **두 미감 동시 만족** — UI 영역 (라벨/버튼/meta) 은 v2 의 직각 모노 hairline 그대로. 사용자 입력 영역 (메모/일기) 만 `Caveat` + `Gowun Dodum` 손글씨 + `--paper` 종이톤 + `--ink-blue` 만년필 잉크.
- **4 진입점** — 훈련 직후 / 하루 마무리 / 경기 직전 / 경기 직후. 각각 다른 폼.

### v3 가 v2 위에 얹는 것
| 추가물 | 어디 |
|---|---|
| 손글씨·종이 토큰 | `colors_and_type_journal.css` (기존 `colors_and_type.css` 위에 import) |
| Mobile 모듈 | `ui_kits/trainoracle-app-v3/` 9개 파일 |
| Journal primitives | `IndexCard · MoodStrip · IntensityDots · IntensityStack · Stamp · PainDot · Sparkline · Delta` |
| Mood/Pain 5단계 | `--mood-1..5`, `--pain-1..5` |
| 마스킹 테이프 / 잉크 스탬프 | `.tape`, `.tape.sage`, `.stamp` |
| 노트 배경 | `.paper-grid` (8px dot), `.paper-lines` (24px lined) |

### v3 가 깨면 안 되는 v2 규칙
- 직각 (radius ≤ 4px). avatar circle 만 예외.
- 그라데이션 금지.
- **UI 텍스트** 에서 이모지 금지. 사용자 입력 (메모/일기) 만 자유.
- 모든 숫자 `tabular-nums`.
- 에너지 시스템 인코딩 (BA/LT/V2/GL/AP/RE) = 도트 + 코드 + underline. 배경색으로 인코딩하지 않는다.

### Tweaks 로 노출되는 옵션 (v3)
- Home variant: A.Journal / B.Sparkline / C.Recall
- Log detail variant: A.Journal page / B.Dashboard
- Trends variant: A.Scroll / B.Tabs
- AI 표시 토글
- 강도 인코딩: dot-code / chip / glyph

> v2 의 AI 코칭·Inbox·Calendar 흐름은 코치 페르소나용 별도 모듈로 보존. v3 로 흡수하지 않는다.

---

## About the Design Files

**The files in this bundle are design references created in HTML.** They are prototypes that show the intended look, layout, typography, and interaction behavior — not production code to copy directly.

Your task is to **recreate these HTML designs in the target codebase's existing environment** using its established patterns and libraries. If no codebase exists yet, the recommended stack (from the original brief) is:

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + CSS variables for tokens (the variable list is in `colors_and_type.css`)
- **UI primitives**: Radix UI (headless). **Avoid heavy style-opinionated libs like shadcn/ui** — the system is too distinctive to fit pre-styled components cleanly
- **State**: Zustand + React Query
- **Charts**: Visx or Recharts, but enforce Tufte styling (hairline grid, single color per line, no fills)
- **Backend**: Supabase or Hono + Postgres
- **AI**: Claude API + RAG (coach notes + user data); rule-engine validation in pure TypeScript

Do **not** ship the HTML files directly. They use inline styles, CDN fonts, and demo data. The CSS variables in `colors_and_type.css` are the canonical source — transcribe them into your codebase (Tailwind config, theme provider, or wherever your project conventions put them).

---

## Fidelity

**High-fidelity (hifi).** All colors, typography, spacing, border weights, and component dimensions are final. The visual language has been through a v1 → v2 pivot (Instrument Serif removed, rounded corners removed, gradient backgrounds removed) — what you see is the intended endpoint. Recreate it pixel-precisely.

Note: **The 5 desktop screens in `ui_kits/trainoracle-app/` are the canonical v2 reference.** Some files in `reference_designs/` (e.g., `03_Dashboard.html`, `04_Calendar.html`) are v1 — they have rounded corners and a dark theme. They are kept for context only; do not implement from them. Always cross-check against the UI kit and `colors_and_type.css`.

---

## Screens / Views

### 1. Dashboard (`ui_kits/trainoracle-app/Dashboard.jsx`)

**Purpose** — The athlete's daily landing page. Tells them what to do today, where they are in the cycle, which rules are passing, and what the AI inbox is flagging.

**Layout** — Single column, max-width 1100px, centered. Vertical sections separated by 40px gaps:
1. Greeting row (with mode chip in top-right)
2. § 1 — 9.5-day cycle rail
3. § 2 — Today's session card
4. § 3 / § 4 — Two-column: 9 Rules validation list + AI inbox preview (50/50 split)
5. § 5 — Weekly KPI metric grid

**Components**
- **Mode chip** — top-right, 1px ink-3 border, 5px 10px padding, mono 11px, uppercase, letter-spacing 0.04em. States: `NORMAL` / `CAUTION` / `RECOVERY` / `RACE WEEK` / `OFF-SEASON`
- **Greeting** — `t-h1` (28px, weight 500, letter-spacing −0.025em). Format: `"<name>, 좋은 아침이에요."`
- **CycleRail** (see Primitives) — 10 cells, MAIN day inverted black
- **Today's session card** — 1px ink solid border (not hairline), 20px 22px padding. Header row: mono session-time + EnergyTag + right-aligned mono duration. Title 22px weight 500. Body has 2px ink left border, 12px left padding, 14px ink-2 text. Footer is dashed-top metric strip with HR / pace / RPE.
- **9 Rules list** — top + bottom 1px ink borders. Each row: 20px status icon (✓/!/i/✕) + 48px R-code mono + flex-1 description. Dashed hairline between rows.
- **AI Inbox items** — 2px colored left border (unc=purple, risk=warn, pat=info, pass=ok), 12px padding. 3-column grid: 56px athlete name (mono uppercase) + flex title/desc + auto-width timestamp.
- **Metric grid** — flex row, 4 cells with 1px hairline dividers, top+bottom ink borders.

---

### 2. Session Detail (`ui_kits/trainoracle-app/SessionDetail.jsx`)

**Purpose** — The full plan for a single training session: what to do, why this is what the system recommends, the protocol breakdown, and the actions.

**Layout** — Single column, max-width 1100px. Sections:
1. Breadcrumb (back button + path)
2. Hero — MAIN marker + EnergyTag + meta on one row, then huge title (36px), then 2px-ink-bordered "purpose" line
3. Metric grid — 5 cells (Volume / Duration / Target pace / Target HR / TSS)
4. § 1 — "Why this session" — AI message block (verdict + confidence + body with inline citations + alternative view)
5. § 2 — Protocol phases (one row per phase, MAIN phase has brand-tinted background and 2px brand left border)
6. Action row — Primary "세션 시작" + Secondary "코치에게 전달" + Tertiary "편집"

**Components**
- **MAIN marker** — `※` prefix glyph (font-size 13px) + "MAIN" text (mono 11px 600, letter-spacing 0.08em, uppercase). No background.
- **EnergyTag** — see Primitives. The hero uses `system="vo2"`.
- **Hero title** — 36px Inter 500, letter-spacing −0.03em, line-height 1.1, max-width 820px, `text-wrap: balance`.
- **Why block** — 2px ink left border, padding 14px 16px, surface background. Header: brand-color dot + "장호준 AI" + verdict chip + timestamp.
- **Citation pill inline** — `<a>` mono 11px, brand color, underlined with 2px offset. Format `[J1]`, `[P2]`, `[Y3]`, `[C4]` (Jang / Paper / You / Cohort).
- **Phase row** — Grid 40px (index) / 1fr (body) / auto (energy tag). 16px vertical padding, 1px line bottom border. MAIN phase: 12px left padding, 2px brand left border, `rgba(13,95,90,0.04)` background.

---

### 3. Calendar (`ui_kits/trainoracle-app/Calendar.jsx`) — ★ Differentiator

**Purpose** — Show training organized by 9.5-day cycles instead of weeks. This is the product's most distinctive feature.

**Layout** — Single column, max-width 1200px:
1. Header row — `h1 "캘린더"` left, segmented view switcher right (Week / 9.5-Cycle / Timeline)
2. Cycle list — 3-column grid showing Cycle 6 (done) / Cycle 7 (now) / Cycle 8 (next)
3. Active cycle detail — the **CycleRail** expanded with vol per day
4. Energy distribution — full-width 14px stack bar with mono legend underneath

**Components**
- **View switcher** — 1px ink border container, inline-flex of 3 buttons. Active: ink bg + bg color text. Inactive: transparent + ink-2 text. Mono 11px, uppercase, letter-spacing 0.08em.
- **Cycle card** — 16px 18px padding, divided by 1px line borders, no rounding. "now" cycle has `surface-2` background; the status line under the date range uses brand color.
- **Day cell** (in expanded rail) — 96px min-height, flex-column: day code (mono 9.5px) → dot + 2-char code → volume (mono 10.5px, bottom-aligned). MAIN cell is fully inverted (ink bg, white text, "※ MAIN" mono 8.5px at bottom).
- **Energy distribution bar** — height 14px, 1px ink border, sub-divs use raw energy hex colors (this is the only context where energy colors fill a region — at 14px height it reads as a typography rule, not a "container").

---

### 4. AI Chat (`ui_kits/trainoracle-app/AIChat.jsx`)

**Purpose** — Conversation with the AI persona "장호준 AI". Persistent context bar at top, conversation history in left rail, composer at bottom.

**Layout** — Full-height, 2-column: 240px conversation list + flex-1 thread. Thread = column (context bar + scrolling messages + composer pinned bottom).

**Components**
- **Conversation list item** — 10px 16px padding. Active: `surface-2` bg + 2px ink left border. Title 12.5px (font-weight 500 if active, 400 otherwise), date below in mono 10px ink-3.
- **Context chip** — Above messages: brand dot + "CONTEXT · 민지 · Cycle 7 · D-5/9.5 · CK +18% · RPE 5.8 · 무릎 3/5". Mono 10px, ink-3, letter-spacing 0.14em, uppercase, 600 weight.
- **User message** — Plain block (no avatar). Mono header "민지 · 14:18" (10px, 600). Body box: surface-2 bg + 1px line border, 10px 14px padding, max-width 620px. **No bubble shape**, square corners.
- **AI message** — Border-left 2px ink, surface bg, padding 14px 18px. Header: brand dot + "장호준 AI" + verdict chip + timestamp. Body can contain prose, an inline data table, alternative-view block, ref pills, and action buttons.
- **Inline citation** — `[J1]`, brand-color mono, underlined.
- **Source ref pill** — 1px line border, mono 10.5px, ink-3 text. Inner badge: 1-letter (J/P/Y/C), bordered with that tier's color, mono 9.5px 600. Then `[n]` (ink), then short label.
- **Composer** — Border-top 1px line. Container: 1px line border on `var(--surface)`, no rounding. Input no border, transparent. Send button = Primary `<Button size="md" kbd="↵">전송</Button>`.

---

### 5. AI Inbox (`ui_kits/trainoracle-app/Inbox.jsx`)

**Purpose** — The coach view. AI auto-routes items here when confidence is below threshold, a rule is broken, a risk pattern is detected, or a cycle completes.

**Layout** — Full-height, 2-column: flex-1 list + 360px detail panel.

**Components**
- **List header** — Padded 24px 28px 16px, 1px line bottom. `h1 "AI 인박스"` left, mono count right.
- **List item** — Grid `80px / 1fr / auto`, 16px gap, 14px 28px 14px 26px padding. 2px colored left border. First item active = `surface-2` bg. Athlete name (mono 11px 600), title (sans 14 / 500), description (mono 11 ink-3), meta line (mono 9.5, uppercase, ink-4).
  - Colors by kind: unc = `--unc` purple, risk = `--warn`, pat = `--info`, pass = `--ok`, lack = `--ink-3`, rule = `--err`.
- **Detail panel** — 28px 26px padding. Section label → h2 → verdict + meta → boxed AI summary → "AI가 본 데이터" table → action buttons → track-record footer.
- **Track record block** — `surface-2` bg, mono 11px, ink-2 text. Calls out historical agreement rate so the coach knows how trustworthy this AI is at this category of judgment.

---

### 6. Sidebar (`ui_kits/trainoracle-app/Sidebar.jsx`)

**Purpose** — Persistent left nav, shown on all desktop screens.

**Layout** — 220px fixed width, full-height, 1px right border, flex-column.

**Sections (top → bottom)**
1. **Brand block** — TRAIN·O·RACLE wordmark with two brand-color dots between letters (3×3px, brand bg, border-radius 50%, translateY −4px). Below: mono 9.5px caption "v0.3.1 · 민지".
2. **Memory chip** — Stack of mono lines showing CONTEXT (Cycle, recent session, current injury). Sits in a region with a hairline bottom border.
3. **Nav list** — 6 items. Each item is a `<button>`: left-aligned label + right-aligned shortcut (`⌘1`–`⌘6`). Active state: `surface` bg + 2px ink left border + ink text (500). Inactive: transparent + ink-2 (400).
   - Inbox item has a small badge counter — `var(--err)` bg, white text, mono 9px 600, square (no rounding).
4. **User footer** — 28px circular avatar (the only `border-radius: 50%` allowed besides energy dots) with ink bg + bg-colored mono initials. Name + PB on the right.

---

### 7. Top Bar (`ui_kits/trainoracle-app/App.jsx` → `TopBar`)

A 14px 36px padded row with 1px line bottom border and `backdrop-filter: blur(10px)` on a 92%-opacity bg. Mono breadcrumb on the left (uppercase, letter-spacing 0.14em); right side has `⌘K` quick-search hint + current date in KST.

---

### 8. Reference Designs (`reference_designs/`)

These 6 standalone HTMLs from the original sprint show additional screens not yet built in the UI kit. Use them as visual reference, but expect minor token drift (some still use Instrument Serif imports, rounded corners, or dark-theme variables — all of which have been deprecated):

| File | Status | Purpose |
|---|---|---|
| `01_Landing.html` | v2 ✓ | Marketing landing — hero, vs-Strava/TrainingPeaks compare grid, 3 pillars, feature rows, final CTA |
| `05_SessionDetail.html` | v2 ✓ canonical | Same as UI kit, includes mobile 380px frame |
| `06_AIChat.html` | v2 ✓ | Same as UI kit |
| `SPRINT1_MinjisDay.html` | v2 ✓ | The "Minji's Day" 6-cut demo showing all 4 horizontal systems in one user's day |
| `03_Dashboard.html` | **v1 — DO NOT IMPLEMENT** | Has rounded 12px corners + dark theme; kept for archive |
| `04_Calendar.html` | **v1 — DO NOT IMPLEMENT** | Same issue as 03 |

For Landing and the "Minji's Day" sequence, use the v2 reference HTML directly; everything else, use the UI kit.

---

## Interactions & Behavior

### Global

- **Sidebar nav** — Clicking an item swaps the main `<main>` content. State persists in `localStorage['to_route']` so refresh keeps the user where they were.
- **Cmd palette (⌘K)** — Not yet implemented; placeholder hint in top bar. When built: fuzzy search across athletes, sessions, references, rules, cycle days. See `design-system/COMPONENT_INVENTORY.md` § 3.
- **Memory chip refresh** — On each route change, the sidebar memory chip should re-read latest context (current cycle, last session summary, current injury) from store.

### Dashboard

- **Today's session card** — Click anywhere in the card → navigate to Session Detail. Hover: no visual change (no `transform`, no shadow). The 1px ink border alone is the affordance.
- **AI inbox items** — Click → open AI Chat focused on that conversation.

### Session Detail

- **Back button** — `← Dashboard` mono link returns. Use browser-history-style back, not a hard route push, if practical.
- **"세션 시작"** — Primary action. In the live app, triggers a start timer + GPS/HRM capture state. In the demo, can be a no-op stub.
- **"출처 펼침"** — Tertiary action in the § 1 header should toggle a side panel showing the full text of each citation. Not implemented in mockup — placeholder.

### AI Chat

- **Composer Enter** — Append a new user message, then after 600ms append a stub AI message (`verdict: 'lack'`). Real backend integration is the developer's responsibility.
- **Conversation list item click** — Should load that thread. In the demo, the active item is hard-coded as the first row.
- **Citation pill click** — Should open a side panel with the original quote (1–2 sentences). Not implemented yet.

### Inbox

- **List item click** — Updates the right detail panel. Demo only renders the first item's detail; full state-routing is the developer's responsibility.
- **"−10% 적용"** — Apply AI's recommended adjustment to the upcoming session(s). Triggers a confirmation toast.
- **"민지와 대화"** — Open AI Chat with this athlete's context preloaded.

### Animation Rules (from `PHILOSOPHY.md` § 9)

- ✅ Allowed: color transitions, opacity, underline-grow on hover, typing dots, sticky bar slide-up, modal fade-in
- ❌ Banned: `bounce`, `elastic`, particle effects, shine sweeps, scale-on-press, gradient sweeps

| Duration token | ms | Use |
|---|---|---|
| `dur-instant` | 80 | Hover color |
| `dur-fast` | 150 | Color, small transitions |
| `dur-base` | 200 | Default |
| `dur-slow` | 300 | Larger position changes |
| `dur-slower` | 500 | Page transitions |

| Easing | Value | Use |
|---|---|---|
| `ease-default` | `cubic-bezier(0.2, 0, 0.2, 1)` | Most |
| `ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances |
| `ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | Exits |

---

## State Management

### Per-screen state

| Screen | Local state | Global/persistent |
|---|---|---|
| Dashboard | (none) | Current cycle position, today's sessions, 9-Rules validation results |
| Session Detail | Session start/pause/stop (when live) | Session by id, AI "why" response, cited refs |
| Calendar | View mode (`'week' \| '9.5-cycle' \| 'timeline'`), selected cycle | Cycle history, energy distribution |
| AI Chat | Current input text, current thread id | Thread list, message history per thread |
| Inbox | Selected item id, filter | Inbox items (auto-populated from rules engine + AI) |

### Recommended global stores

- **`useUserStore`** — `name`, `currentCycle`, `currentDay`, `currentMode`, `recentSessionSummary`, `injuries[]`. This feeds the sidebar memory chip and AI context.
- **`useCycleStore`** — Cycle id → 10 day plan. Used by Calendar & CycleRail. The active cycle exposes `today` (1–10).
- **`useInboxStore`** — Items with `verdict`, `confidence`, `athlete`, `kind`, `metadata`, `read`, `decision` (accepted/modified/rejected). The "Decision Log" feature should be a derived selector over this.
- **`useAIThreadStore`** — Threads keyed by id; each message has `role`, `verdict`, `confidence`, `body`, `sources[]`, `alternativeView`, `actions[]`, `metadata`.

### Verdict & confidence contract

**Every AI-authored object must include:**

```ts
type Verdict = 'confirm' | 'recommend' | 'unc' | 'lack';

type AIPayload = {
  verdict: Verdict;
  confidence: number;          // 0-100; if < 0.5 throw or return LACK
  body: ReactNode | string;
  sources: Array<{
    n: string;                   // e.g. "J1"
    tier: 'J' | 'P' | 'Y' | 'C'; // Jang / Paper / You / Cohort
    title: string;
    excerpt?: string;            // 1-2 sentences, shown on click
    href?: string;
  }>;
  alternativeView?: string;     // required for `recommend`/`unc`
  actions?: ButtonProps[];
  metadata?: { model: string; ts: Date; sourcesConsidered: number };
};
```

If a piece of code emits an AI claim without all three of `{verdict, confidence, sources}`, **fail the lint** — the system depends on the social contract that AI never speaks unattributed.

---

## Design Tokens

All values live in `colors_and_type.css`. The complete machine-readable list is in `design-system/DESIGN_TOKENS.md` (Tailwind-ready). Summary below.

### Colors — Neutrals (warm off-white, teal-tinted ink)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FAFAF7` | Primary surface |
| `--surface` | `#FFFFFF` | Card / elevated |
| `--surface-2` | `#F4F3EE` | Recessed |
| `--ink` | `#0E1412` | Primary text |
| `--ink-2` | `#2B3330` | Secondary text |
| `--ink-3` | `#5F6965` | Tertiary / meta |
| `--ink-4` | `#8F9894` | Quaternary / disabled |
| `--line` | `#D9D6CE` | Default border |
| `--line-2` | `#BFBBB0` | Stronger border |
| `--hair` | `#E8E6DF` | Hairline divider |

### Colors — Brand (single Deep Teal accent)

| Token | Hex | Use |
|---|---|---|
| `--brand` | `#0D5F5A` | Primary accent (dots, links, CTA hovers) |
| `--brand-ink` | `#07302E` | Darker variant |

### Colors — Semantic

| Token | Hex | Use |
|---|---|---|
| `--ok` | `#1F7A3A` | CONFIRM verdict, pass |
| `--warn` | `#B4530C` | LACK verdict, caution |
| `--err` | `#A11F1F` | Failure, injury marker, badge count |
| `--info` | `#1D4ED8` | Neutral info, paper-citation tier |
| `--unc` | `#6B3FB0` | UNC verdict, AI uncertainty |

### Colors — Energy Systems (dot + underline ONLY — never as bg fill)

| Token | Hex | Code | Zone |
|---|---|---|---|
| `--e-base` | `#4A8FC7` | BA | Z1–Z2 Aerobic Base |
| `--e-lt` | `#B8A024` | LT | Z3–Z4 Lactate Threshold |
| `--e-vo2` | `#C7761C` | V2 | Z5 VO2max |
| `--e-gly` | `#B8332E` | GL | Z6 Glycolytic |
| `--e-atp` | `#7A3FB5` | AP | Z7 ATP-PC |
| `--e-rest` | `#7A7A70` | RE | Recovery / off |

4-tier variants (`*-strong`, `*-mid`, `*-text`, `*-wash`) are defined in `colors_and_type.css` for cases like stack-bar fills in the Calendar's energy distribution row — read them from the CSS, not from the README.

### Typography

- **`--sans`** — `"Inter", "Pretendard Variable", ui-sans-serif, system-ui, sans-serif`
- **`--mono`** — `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace`
- **No serif.** Instrument Serif was used in v1 and removed in v2. Do not reintroduce.

Loaded via:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" rel="stylesheet">
```

For offline / self-hosted production: download Pretendard Variable woff2 + Inter + JetBrains Mono to `/public/fonts` and `@font-face` them.

### Type scale

| Token | Size | Weight | Letter-spacing | Use |
|---|---|---|---|---|
| `t-display` | clamp(56, 8vw, 116)px | 500 | −0.045em | Landing hero |
| `t-h1` | clamp(32, 4.5vw, 52)px | 500 | −0.03em | Page titles |
| `t-h2` | clamp(22, 3vw, 32)px | 500 | −0.02em | Section heads |
| `t-h3` | 18px | 500 | −0.01em | Subsection |
| `t-body-lg` | 16.5px | 400 | −0.005em | Philosophy / long-form |
| `t-body` | 14.5px | 400 | −0.005em | Default UI body |
| `t-body-sm` | 13px | 400 | −0.005em | Captions / refs |
| `t-caption` | 12px | 400 | (none) | Compact meta |
| `t-mono-sm` | 11px | 500 | 0.06em + uppercase | Default label |
| `t-mono-xs` | 10px | 600 | 0.14em + uppercase | Meta chip |

All numeric content uses `.mono { font-variant-numeric: tabular-nums }`.

### Spacing (4px base)

| Token | px | Use |
|---|---|---|
| `--space-1` | 4 | Micro |
| `--space-2` | 8 | Compact (chip gap) |
| `--space-3` | 12 | Default gap |
| `--space-4` | 16 | Standard |
| `--space-5` | 20 | Mobile section padding |
| `--space-6` | 24 | Desktop section padding |
| `--space-8` | 32 | Large sections |
| `--space-10` | 40 | Large gaps |
| `--space-12` | 48 | Hero padding |
| `--space-16` | 64 | Screen-level separation |

### Container widths

- Mobile frame: 360–380px (the bezel adds chrome)
- Desktop max-width: 1408px frame / 1240px content / 780px article / 1100px app
- Sidebar: 220px
- Detail panel: 280–420px

### Radius

| Token | Value | Use |
|---|---|---|
| `--r-0` | 0 | Default. All boxes, all cards. |
| `--r-sm` | 2px | Subtle |
| `--r-md` | 4px | **Max**. Inputs / buttons only. |

**Avatar circles use `border-radius: 50%`** — the only exception. Anything else over `4px` is banned.

### Border weights

| Token | px | Use |
|---|---|---|
| `--bw-hair` | 1 | Hairline (using `--hair`) |
| `--bw-line` | 1 | Default (using `--line`) |
| `--bw-bold` | 1 | Solid emphasis (using `--ink`) |
| `--bw-strip` | 2 | Left color strip (inbox items) |
| `--bw-under` | 1.5 | Energy underline / verdict underline |

### Shadows

Almost none. Visual hierarchy comes from color, border, and whitespace.

| Token | Value | Use |
|---|---|---|
| `--shadow-frame` | `0 40px 100px -30px rgba(0,0,0,.22), 0 10px 30px -10px rgba(0,0,0,.12)` | Mobile/desktop preview chrome only — not real UI |
| `--shadow-subtle` | `0 1px 2px rgba(0,0,0,.04)` | Optional hover-lift, sparingly |

❌ glow, neumorphism, drop-shadow blur ≥ 12px — all banned.

### Z-index

| Layer | z | Use |
|---|---|---|
| `--z-base` | 0 | |
| `--z-sticky` | 10 | Sticky bottom bar |
| `--z-overlay` | 50 | Overlays |
| `--z-modal` | 100 | Modals, top nav |
| `--z-toast` | 200 | Toasts |
| `--z-tooltip` | 300 | Tooltips |

---

## Korean / English Mix Rules (Content)

| Category | Language | Example |
|---|---|---|
| UI labels | Korean | 대시보드, 캘린더, 분석 |
| General messages | Korean | "좋은 아침이에요" |
| **Training terminology** | **English** | VO2, LT, BASE, MAIN, AUX, CK, RPE, TSS, TSB |
| Measurements | English + mono | `HR 178`, `TSS 124` |
| Pace / time | English + mono | `3'20"/km`, `16:10.44` |
| Rule / cycle codes | English + mono | `R-6`, `D-5`, `T-2` |

User names: first appearance in a session uses `<name>님`; subsequent same-session uses bare `<name>`. The distinction is intentional. See `PHILOSOPHY.md` § 6 for the full content guide.

**No emoji in UI. Ever.** User-input emoji is fine; system-emitted emoji is not.

---

## Iconography

1. **Unicode marks** are first-choice glyphs: `●` (energy dot, 7px), `※` (MAIN), `▸` (expand), `↗` (external), `↵` (enter), `⌘` (cmd), `✓` (pass), `✕` (fail), `—` (divider). Render them in `var(--mono)` for consistency.
2. **SVG outline icons** when unicode won't do. Stroke 1.5–2px, `currentColor`, square joins, no fills. The system does NOT ship its own icon font yet.
3. **Substitution:** Use [Lucide](https://lucide.dev) (CDN or `lucide-react`) as the closest visual match. **Flag this substitution to the team** if you ship to production — long-term plan is a bespoke 24-icon outline set.

See `preview/iconography.html` for the spec card and starter Lucide-style examples.

---

## Assets

The brand marks are inline SVG (small, hand-rolled):

| File | Use |
|---|---|
| `assets/wordmark.svg` | TRAIN·O·RACLE — light context |
| `assets/wordmark-inverted.svg` | Same, white text — dark context |
| `assets/mark-jh.svg` | AI persona sign — `● JH`, never an avatar illustration |

**No raster brand assets.** No photography, no illustration. The original design files use only:
- Webfonts (Inter / Pretendard / JetBrains Mono — CDN)
- SVG brand marks (above)
- Unicode + simple stroke SVG icons

When real product photography or athlete photos are needed (e.g., for a marketing landing), the brief mandates cool-toned, desaturated, near-monochrome treatment. **No saturated sportswear-ad colors.**

---

## Files

### Canonical implementation source

| File | What |
|---|---|
| `colors_and_type.css` | v2 토큰. 모든 CSS 변수 + semantic type. **Transcribe this into your Tailwind config / theme.** |
| `colors_and_type_journal.css` | **v3 일지 확장.** 종이톤·손글씨·mood·pain·테이프·잉크 스탬프. 위 파일 import 후 얹어 사용. |

**v3 — Journal-first mobile (current main)**

| File | What |
|---|---|
| `ui_kits/trainoracle-app-v3/index.html` | **새 메인 엔트리** — 7 화면 통합 미리보기 |
| `ui_kits/trainoracle-app-v3/App.jsx` | 7 frame 가로 정렬 + flex-wrap + Tweaks 패널 |
| `ui_kits/trainoracle-app-v3/MobileFrame.jsx` | 직각 직사각 모바일 베젤 |
| `ui_kits/trainoracle-app-v3/JournalPrimitives.jsx` | `IndexCard · MoodStrip · IntensityDots · IntensityStack · Stamp · PainDot · Sparkline · Delta · SectionLb` |
| `ui_kits/trainoracle-app-v3/Home.jsx` | 3 변형 (A.Journal / B.Sparkline / C.Recall) |
| `ui_kits/trainoracle-app-v3/LogEntry.jsx` | Chooser + Post-session + Evening + Race (pre/post) + BodyDiagram |
| `ui_kits/trainoracle-app-v3/LogDetail.jsx` | 2 변형 (A.Journal page / B.Dashboard) |
| `ui_kits/trainoracle-app-v3/Trends.jsx` | 2 변형 (A.Scroll / B.Tabs) |

**v2 — Desktop coach app (archive, do NOT implement new features here)**

| File | What |
|---|---|
| `ui_kits/trainoracle-app/index.html` | Entry — loads React + all JSX |
| `ui_kits/trainoracle-app/App.jsx` | Top-level router, sidebar+topbar shell, route persistence |
| `ui_kits/trainoracle-app/Primitives.jsx` | `EnergyTag`, `Verdict`, `MainMark`, `Button`, `MetricCell`, `SectionHeader`, `CycleRail` |
| `ui_kits/trainoracle-app/Sidebar.jsx` | Left nav (220px) |
| `ui_kits/trainoracle-app/Dashboard.jsx` | Home screen |
| `ui_kits/trainoracle-app/SessionDetail.jsx` | Session view |
| `ui_kits/trainoracle-app/Calendar.jsx` | 9.5-cycle calendar (differentiator) |
| `ui_kits/trainoracle-app/AIChat.jsx` | AI conversation |
| `ui_kits/trainoracle-app/Inbox.jsx` | Coach AI inbox |

### Authoritative docs

**먼저 읽을 것 (v3 맥락):**

| File | Read this when… |
|---|---|
| **`DECISION_LOG.md`** | **…처음 합류했다. "왜 일지로 출시하는지" 의 핵심. 14개 질문 원문 포함. 가장 먼저 읽으세요.** |
| `VARIANTS.md` | …Home 3 / LogDetail 2 / Trends 2 변형이 각각 누구를 노리는지 |
| `NEGATIVE_SPACE.md` | …"이거 추가하면 좋지 않아?" 충동이 들 때. 의도적으로 거부한 옵션 목록 |
| `SESSION_TIMELINE.md` | …이 디자인 시스템이 어떤 순서로 만들어졌는지 (v1 → v2 → v3 피벗 기록) |
| `HANDOFF_NEXT_CHAT.md` | …이전 디자인 세션에서 무엇이 마지막이었는지 |

**시스템 규칙 / 토큰:**

| File | Read this when… |
|---|---|
| `PHILOSOPHY.md` | …you're unsure if a decision violates a brand rule (10 rules + 10 prohibitions) |
| `DESIGN_DECISIONS.md` | …you wonder why v1 looked one way and v2 looks different |
| `design-system/DESIGN_TOKENS.md` | …you need exact values in Tailwind format |
| `design-system/COMPONENT_INVENTORY.md` | …you need component props/variants spec |
| `design-system/SYSTEM_FOUNDATIONS.md` | …you're building Trust / Identity / Visualization / Feedback features that span multiple screens |
| `design-system/SCREENS.md` | …you want the screen-by-screen status & next-work list |
| `design-system/FEATURE_TIERS.md` | …you need MVP / v1 / v2 priority |
| `design-system/SAFEGUARDS.md` | …you're touching anything safety-critical (injury reporting, false positives, AI overconfidence) |
| `SKILL.md` | Quick orientation — design rules in one page |

### Preview cards (reference only — don't ship)

`preview/*.html` — 26 design-system spec cards that explain individual tokens and components in isolation. Useful when you want a single screen showing "what does an Energy tag look like in isolation?" without the surrounding UI noise.

### Reference designs (visual archive)

`reference_designs/*.html` — Six standalone screens from the design sprint. The non-v1 ones (`01_Landing.html`, `05_SessionDetail.html`, `06_AIChat.html`, `SPRINT1_MinjisDay.html`) are good visual references for screens not yet in the UI kit. The v1 ones (`03`, `04`) are kept for archive only and **should not be implemented**.

---

## Validation Checklist (run before merge)

- [ ] `border-radius` ≤ 4px everywhere (except `50%` avatar circles)?
- [ ] No serif fonts anywhere?
- [ ] No emoji emitted by the system (user input is fine)?
- [ ] No saturated background colors on cards?
- [ ] No gradients (linear / radial / conic)?
- [ ] All numbers use `tabular-nums`?
- [ ] All mono labels have `letter-spacing ≥ 0.06em`?
- [ ] All touch targets ≥ 44px?
- [ ] Every AI utterance carries `verdict + confidence + sources`?
- [ ] Every `recommend` or `unc` utterance also has an `alternativeView`?
- [ ] Training terms (`VO2`, `LT`, `TSS`, etc.) preserved in English?
- [ ] No badges / streaks / "great job!" toasts?
- [ ] Hover states use color, not transform/scale?

---

## One thing to remember

> **"This tool helps the coach think — it does not replace the coach."**

Every implementation decision should pass that line. If a feature makes the AI more authoritative at the expense of the coach's judgment, redesign it. If it surfaces evidence and lets the coach decide, ship it.
