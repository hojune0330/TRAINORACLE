# COMPONENT INVENTORY

> 디자인 산출물에서 추출 가능한 재사용 컴포넌트 목록. 개발 시 이 단위로 만드세요.

---

## 사용 가이드

각 컴포넌트는 다음 정보를 가집니다:
- **Used in**: 어느 디자인 화면에서 사용
- **Variants**: 변형 종류
- **Props (예상)**: TypeScript-style hint
- **Notes**: 구현 시 주의점

---

## 1. Primitives (기본 요소)

### 1.1 `Button`
- **Used in**: 모든 화면
- **Variants**:
  - `primary` (ink bg, bg text)
  - `secondary` (transparent bg, line border)
  - `tertiary` (mono text, underline only)
  - `danger` (err border + err text)
- **Sizes**: sm (32px), md (44px — touch min), lg (52px — sticky bar)
- **Props**: `variant, size, leadingIcon, trailingIcon, children, kbd?`
- **Notes**:
  - `border-radius: 0`
  - 모바일 sticky button: `min-height: 52px`
  - kbd prop는 우측 단축키 표시 (`<span class="kbd">↵</span>`)

### 1.2 `IconButton`
- **Used in**: 헤더, 인박스 등
- **Variants**: `default`, `subtle` (transparent)
- **Sizes**: 32px, 40px, 44px (모바일 터치)
- **Notes**: 둥근 사각형 X. 직각 + hairline border.

### 1.3 `Tag`
- **Used in**: Session Detail, Calendar, AI Chat
- **Variants**:
  - `main` (ink bg + ※ prefix)
  - `aux` (mono text + line border)
  - `track` (mono text + bottom underline)
- **Props**: `variant, children`

### 1.4 `EnergyTag` ★ 핵심 차별 컴포넌트
- **Used in**: Session, Calendar, Analysis, AI Chat
- **Visual**:
  ```
  ● V2  VO2-Long
       ─────
  ```
- **Props**:
  ```ts
  type EnergySystem = 'BASE' | 'LT' | 'VO2' | 'GLY' | 'ATP' | 'REST';
  // codes: 'BA' | 'LT' | 'V2' | 'GL' | 'AP' | 'RE'
  type Props = { system: EnergySystem; showName?: boolean }
  ```
- **Notes**:
  - 7px 도트 (system color)
  - 2자 모노 코드 (ink color)
  - 1.5px 하단 underline (system color)
  - **배경색 절대 사용 금지**

### 1.5 `Verdict`
- **Used in**: AI Chat, Session Why, AI Inbox
- **Visual**: 모노 텍스트 + 하단 1.5px underline (system color)
- **Variants**:
  - `confirm` (ok 색)
  - `recommend` (brand 색)
  - `unc` (unc 색)
  - `lack` (warn 색)
- **Props**: `variant, children`

### 1.6 `Toggle`
- **Used in**: Settings
- **Visual**: 42×24 직각 슬라이더, 4px 동그라미 (radius 0이지만 토글은 예외 — 4px)
- **Props**: `checked, onChange, label?, description?`

### 1.7 `Stepper` (numeric)
- **Used in**: Daily Check-in (수면 시간)
- **Visual**: −  [7.0 h]  +
- **Props**: `value, min, max, step, unit, onChange`

### 1.8 `Scale` (1-10 RPE)
- **Used in**: Daily Check-in
- **Visual**: 10 cells, hairline border, ink bg on selected
- **Props**: `value, min=1, max=10, onChange, leftLabel?, rightLabel?`

---

## 2. Data Display

### 2.1 `DataTable` (key-value)
- **Used in**: Session Detail, AI Chat (data callout)
- **Visual**:
  ```
  Total volume    │  10.4 km
  Duration        │  62 min
  ```
- **Variants**:
  - `bordered` (top/bottom 1px ink)
  - `dashed` (행 사이 dashed hair)
- **Props**: `rows: Array<{label, value, sub?, variant?}>`

### 2.2 `MetricGrid` (4-column)
- **Used in**: Session Detail Hero, Analysis KPI
- **Visual**: 4분할 가로 행, hairline border
- **Props**: `items: Array<{label, value, unit?, sub?, sparkline?}>`

### 2.3 `ValidationItem`
- **Used in**: Session Detail, Dashboard
- **Visual**:
  ```
  ✓  R-6   VO2 반복 볼륨 기준 내
          6 × 1000m = 6 km · 권고 5–8 km
  ```
- **Props**:
  ```ts
  type Props = {
    status: 'pass' | 'warn' | 'info' | 'fail';
    code: string;          // e.g. 'R-6'
    title: string;
    detail?: string;
  }
  ```

### 2.4 `ReferenceCard` (footnote)
- **Used in**: Session Why, AI Chat sources, Philosophy
- **Visual**:
  ```
  [1]  A_guide Rule 4 — 회복 신호 충돌
       Coach Jang · 2023 · §4.2          open →
  ```
- **Props**:
  ```ts
  type Props = {
    n: string;              // [1]
    title: string;
    source: string;         // sub-meta
    href: string;
  }
  ```

### 2.5 `Spark` (mini chart)
- **Used in**: Analysis KPI
- **Variants**: `line`, `bar`
- **Props**: `data: number[], color, height?`

### 2.6 `Chart.Line`
- **Used in**: Analysis Performance Manager
- **Notes**: SVG inline, hairline grid (#E8E6DF), 3 lines max (CTL/ATL/TSB)
- **Library suggestion**: Visx 또는 Recharts (커스터마이징)

### 2.7 `Chart.Bar`
- **Used in**: Analysis HR drift
- **Notes**: target band 회색 배경, ink/warn 색 막대

### 2.8 `Chart.Distribution`
- **Used in**: Analysis Energy distribution
- **Visual**: 가로 stack bar 14px, 5 segments
- **Props**: `data: Array<{system, percent, label, value}>`

---

## 3. Navigation

### 3.1 `Sidebar` (desktop)
- **Used in**: 모든 인증 화면
- **Width**: 220px
- **Sections**: brand / Training / Coach view / user
- **Item**: nav-link with optional shortcut (`⌘1`)
- **Active state**: surface bg + ink border-left 2px

### 3.2 `Tabs`
- **Used in**: 모든 mobile/desktop 미리보기 (chrome)
- **Visual**: hairline border + ink active bg
- **Variants**: `default`, `pill` (Settings sub-nav)

### 3.3 `Crumb` (breadcrumb)
- **Used in**: Session Detail desktop
- **Visual**: mono text, slash separator, last item bold

### 3.4 `BottomTabs` (mobile)
- **Used in**: Dashboard mobile (이전 v1)
- **Visual**: 60px height, sticky bottom

### 3.5 `RangeSwitcher`
- **Used in**: Analysis (4w / 8w / 12w / 1y / all)
- **Visual**: hairline border + ink active

---

## 4. Feedback

### 4.1 `AIMessage` ★
- **Used in**: AI Chat, Session AI block, Daily Check-in tip
- **Visual**:
  ```
  | 장호준 AI · 판정 불확실 · 신뢰도 72%
  | ─────────────────────────
  | 답변 본문 [1] [2]
  | (data table)
  | (alternative view)
  | (sources)
  | (actions)
  ```
- **Props**:
  ```ts
  type Props = {
    verdict: 'confirm' | 'recommend' | 'unc' | 'lack';
    confidence: number; // 0-100
    children: ReactNode; // markdown rendered with [n] citations
    sources: Reference[];
    alternativeView?: string;
    actions?: ButtonProps[];
    metadata?: { model: string; ts: Date; sourcesConsidered: number };
  }
  ```

### 4.2 `InboxItem`
- **Used in**: AI Inbox, Dashboard widget
- **Visual**: 좌측 2px colored border + 텍스트 layout
- **Props**:
  ```ts
  type Props = {
    type: 'unc' | 'risk' | 'pattern' | 'rule' | 'pass';
    athlete: string;
    title: string;
    description: string;
    timestamp: Date;
    metadata?: Record<string, string | number>;
    read?: boolean;
    selected?: boolean;
  }
  ```

### 4.3 `TypingDots`
- **Used in**: AI Chat
- **Visual**: 3 brand-color dots, bouncing animation 1.2s

### 4.4 `Progress` (bar)
- **Used in**: Daily Check-in, Onboarding
- **Visual**: 2px hairline bg + ink fill

### 4.5 `Countdown`
- **Used in**: Session Detail, Competitions
- **Visual**: ink bg + bg text, mono large number
- **Props**: `target: Date, label?`

---

## 5. Forms

### 5.1 `Input` (text/email)
- **Visual**: 1px line border, padding 12-14px, min-height 48px
- **States**: default / focus (ink border) / error (err border)

### 5.2 `Select`
- **Visual**: same as Input + caret right

### 5.3 `Textarea`
- **Visual**: same as Input + min-height 80-100px

### 5.4 `PBInput` (specialized)
- **Used in**: Onboarding step 2
- **Visual**: event chip + mono input + clear button
- **Props**: `event: string, value: string (m:ss.ms format)`

### 5.5 `BodyDiagram`
- **Used in**: Daily Check-in
- **Visual**: SVG human body silhouette with tappable areas
- **Selected state**: warn-color fill (rgba 0.4)
- **Props**: `selected: BodyArea[], onChange, painLevel: 1-5`

### 5.6 `RoleCard`
- **Used in**: Onboarding step 1
- **Visual**: 좌측 3px brand 띠 (selected) + 직각 border
- **Props**: `title, description, selected, onClick`

### 5.7 `ProviderRow`
- **Used in**: Onboarding step 3, Settings
- **Visual**: 32px logo placeholder + name + status (connected/connect)
- **Props**: `provider, connected, lastSync?, onConnect`

---

## 6. Layout

### 6.1 `MobileFrame` (preview wrapper)
- **Used in**: 모든 미리보기 디자인
- **Visual**: 380×800 black bezel + status bar
- **Notes**: 실제 앱에선 안 씀 (디자인 미리보기 전용)

### 6.2 `DesktopFrame` (preview wrapper)
- **Same as above** — 디자인 미리보기 전용

### 6.3 `SectionHeader`
- **Used in**: Session Detail, Analysis, AI Inbox
- **Visual**:
  ```
  §3 · Protocol                          편집
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ```
- **Props**: `number?: string, title: string, action?: ActionProps`

### 6.4 `StickyBar` (mobile)
- **Used in**: Session Detail, Daily Check-in, Onboarding
- **Visual**: bottom-fixed, ink top border, 1+1 or 2 buttons
- **Props**: `primaryAction, secondaryActions[]`

### 6.5 `RightPanel` (desktop)
- **Used in**: Session Detail, AI Inbox
- **Width**: 320-420px
- **Sections**: stacked with hairline dividers

### 6.6 `Phase` (timeline)
- **Used in**: Session Protocol, Competitions Periodization
- **Visual**:
  ```
  01    Warm-up
        15 min · 2.8 km
        Easy jog 8min ...
        [pace 5'30" · HR 140-155 · zone Z2]
  ```
- **Variants**: `default`, `main` (brand-wash bg + brand border)

---

## 7. Specialized

### 7.1 `CycleRail` (9.5-day)
- **Used in**: Calendar 9.5-Cycle view
- **Visual**: 10-cell horizontal rail, MAIN cell (ink bg, ※ marker)
- **Props**: `days: Array<{label, type, sessions[]}>`
- **Notes**: ★ 핵심 차별화 — 다른 어디서도 없는 컴포넌트

### 7.2 `PaceTable`
- **Used in**: Competitions
- **Visual**: lap × distance × time × cumulative × pace
- **Notes**: target row highlight (surface-2 bg)

### 7.3 `RaceCard` (hero)
- **Used in**: Competitions
- **Visual**: D-Day big number + name + venue + events

### 7.4 `Periodization`
- **Used in**: Competitions
- **Visual**: 5-segment timeline (Build / Build / Peak / Taper / Race)
- **Variants per cell**: `done` (surface-2), `now` (ink), `future` (default)

### 7.5 `BodySilhouette`
- 5.5 BodyDiagram의 raw 컴포넌트 — 별도 분리 가능

---

## 8. 컴포넌트 의존성 그래프

```
Page
├── Sidebar
│   └── NavLink
├── TopBar
│   └── Crumb / Tabs / RangeSwitcher
└── Content
    ├── SectionHeader
    ├── MetricGrid
    │   └── KPICell + Spark
    ├── DataTable
    ├── Phase[] (Protocol)
    ├── ValidationItem[]
    ├── AIMessage
    │   ├── Verdict
    │   ├── DataTable (callout)
    │   ├── ReferenceCard[]
    │   └── Button[]
    ├── InboxItem[]
    └── StickyBar (mobile)
```

---

## 9. 우선 순위 (개발 시)

### MVP 필수 (Week 1-2)
- [ ] Button, IconButton, Tag, EnergyTag, Verdict
- [ ] Input, Select, Textarea, Toggle
- [ ] DataTable, MetricGrid, ValidationItem
- [ ] SectionHeader, Sidebar, Tabs

### Core (Week 3-4)
- [ ] AIMessage (with Verdict + DataTable + Sources)
- [ ] InboxItem
- [ ] Phase (Protocol)
- [ ] StickyBar
- [ ] Countdown

### Differentiation (Week 5)
- [ ] CycleRail (9.5-day)
- [ ] PaceTable
- [ ] BodyDiagram
- [ ] Chart.Line, Chart.Bar (Analysis)

### Polish (Week 6)
- [ ] PBInput, ProviderRow
- [ ] Periodization
- [ ] TypingDots, Progress
- [ ] Spark (mini chart)

---

## 10. 컴포넌트 명명 규칙

- PascalCase 사용
- 단일 단어가 명확하면 단일: `Button`, `Toggle`
- 도메인 컴포넌트는 prefix: `EnergyTag`, `AIMessage`, `CycleRail`
- 변형은 dot notation: `Chart.Line`, `Chart.Bar`
- 조건부 prop은 `?` 표시

---

추가 컴포넌트가 필요하면 이 문서에 먼저 추가하고 구현하세요. **inventory 없는 컴포넌트는 만들지 않습니다.**
