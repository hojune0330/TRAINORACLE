# DESIGN TOKENS

> 모든 색·타입·spacing 값. Tailwind config에 그대로 옮기세요.

---

## 1. Colors

### 1.1 Neutrals (off-white / charcoal)
```css
--bg:         #FAFAF7;  /* warm off-white */
--surface:    #FFFFFF;
--surface-2:  #F4F3EE;  /* slight warm gray */

--ink:        #0E1412;  /* deep charcoal, teal-tinted */
--ink-2:      #2B3330;  /* dark gray */
--ink-3:      #5F6965;  /* medium gray */
--ink-4:      #8F9894;  /* light gray */

--line:       #D9D6CE;  /* default border */
--line-2:     #BFBBB0;  /* stronger border */
--hair:       #E8E6DF;  /* hairline divider */
```

### 1.2 Brand
```css
--brand:      #0D5F5A;  /* Deep Teal — primary accent */
--brand-ink:  #07302E;  /* Brand dark variant */
```

### 1.3 Semantic
```css
--ok:    #1F7A3A;
--warn:  #B4530C;
--err:   #A11F1F;
--info:  #1D4ED8;
--unc:   #6B3FB0;  /* uncertainty (judgment unclear) */
```

### 1.4 Energy systems (4-tier intensity)

> **변경 이력 (정리본 §7.3 / Q1 결정 반영)**: 이전 규칙은 "도트·underline에만 사용, 배경 금지"였다.
> 현재 규칙은 **컨텍스트별 4단계 강도**로 변경됨. 즉시 인지가 필요한 곳에선 색 면적을 키우고,
> 본문 안에선 도트·underline만 유지한다. 자세한 사용 규칙은 `VISUALIZATION_SYSTEM.md` §3 참조.

#### Tier 별 hex (정본)

| System | Code | Mark | Strong (T1) | Mid (T2) | Subtle (T3, text) | Wash (T4, 5%) |
|---|---|---|---|---|---|---|
| BASE Z1–Z2 | BA | ● | `#2A6396` | `#4A8FC7` | `#1D4E75` | `#E8F0F7` |
| LT Z3–Z4 | LT | ● | `#8A7818` | `#B8A024` | `#7A6A1A` | `#F4F0DB` |
| VO2 Z5 | V2 | ● | `#9E5A14` | `#C7761C` | `#8A4A1C` | `#F7E9D9` |
| GLY Z6 | GL | ● | `#8E2421` | `#B8332E` | `#8A2A2A` | `#F2DAD8` |
| ATP Z7 | AP | ● | `#5A2D8A` | `#7A3FB5` | `#5A2F8A` | `#EBE0F5` |
| REST | RE | ● | `#4A4A45` | `#7A7A70` | `#5A5A55` | `#EFEEEA` |

**MIXED(MX)**: 한 세션이 두 시스템에 걸칠 때 — 별도 색 대신 **두 시스템의 줄무늬 또는 50:50 분할**로 표현. 시각화 시스템에서 추후 검토 (Q5 보류 항목).

#### CSS variables
```css
/* Tier 1 — Strong (즉시 인지 — Calendar 셀, Session card 좌측 4–6px 컬러바, hero 등) */
--e-base-strong: #2A6396; --e-lt-strong: #8A7818; --e-vo2-strong: #9E5A14;
--e-gly-strong:  #8E2421; --e-atp-strong: #5A2D8A; --e-rest-strong: #4A4A45;

/* Tier 2 — Mid (분석 차트 — line, bar, distribution stack) */
--e-base-mid:    #4A8FC7; --e-lt-mid:    #B8A024; --e-vo2-mid:    #C7761C;
--e-gly-mid:     #B8332E; --e-atp-mid:   #7A3FB5; --e-rest-mid:   #7A7A70;

/* Tier 3 — Subtle (본문 안 라벨 — 점·코드·underline 색) */
--e-base-text:   #1D4E75; --e-lt-text:   #7A6A1A; --e-vo2-text:   #8A4A1C;
--e-gly-text:    #8A2A2A; --e-atp-text:  #5A2F8A; --e-rest-text:  #5A5A55;

/* Tier 4 — Wash (선택 상태, 배경 힌트 — 5% 톤) */
--e-base-wash:   #E8F0F7; --e-lt-wash:   #F4F0DB; --e-vo2-wash:   #F7E9D9;
--e-gly-wash:    #F2DAD8; --e-atp-wash:  #EBE0F5; --e-rest-wash:  #EFEEEA;

/* 하위 호환 — 기존 코드용 별칭 (mid와 동일) */
--e-base: var(--e-base-mid); --e-lt:  var(--e-lt-mid);  --e-vo2: var(--e-vo2-mid);
--e-gly:  var(--e-gly-mid);  --e-atp: var(--e-atp-mid); --e-rest:var(--e-rest-mid);
```

#### 사용 규칙 요약 (자세한 건 VISUALIZATION_SYSTEM.md §3)

| Tier | 사용처 | 색 면적 | 함께 표시 |
|---|---|---|---|
| **T1 Strong** | Calendar 셀, Session card 좌측 4–6px 컬러바, hero 영역, heatmap 셀, energy stack bar | 큼 | 2자 코드 의무 |
| **T2 Mid** | line/bar/density 차트의 데이터 레이어 | 중 | legend에 코드 |
| **T3 Subtle** | 본문 안 inline tag, mini chip, footnote | 매우 작음 (점 7px + underline 1.5px) | 코드 의무 |
| **T4 Wash** | 선택 상태, 오늘 셀 highlight, 컨텍스트 wash | 배경 (5%) | 본문 텍스트는 ink |

**금지**:
- 채도 더 높임 (Strong 톤이 상한)
- gradient/glow
- T1과 T4를 같은 영역에서 동시에 사용 (둘 중 하나만)
- 코드 미표시 (색만으로 분류 시도 금지 — Q6 결정: 3중 인코딩 의무, 단 컴팩트 모드에선 단계적 노출 허용)

### 1.5 Color scheme — Light only (원칙)

> **결정 (2026-04-29)**: TRAINORACLE은 **다크 모드를 지원하지 않는다**.
> 자세한 근거는 `VISUALIZATION_SYSTEM.md §13.4` 참조.

**적용**:
- 모든 페이지에 `<meta name="color-scheme" content="light">` 명시
- CSS의 `prefers-color-scheme: dark` 미디어 쿼리 사용 금지
- 시스템 다크 추종 비활성화 — 사용자가 OS를 다크 모드로 사용해도 본 앱은 라이트 유지
- 모든 토큰 hex는 **흰 배경 (#FAFAF7) 기준 1세트만** 운영

**근거 요약**:
- Tufte × Linear 시각 톤은 종이·논문의 밝은 배경 + 잉크 대비 전제
- 4-tier × 6 시스템 = 24색을 다크 보정으로 두 번 만들면 토큰 관리 부담 ×2
- 차트 SVG stroke·fill 일관성 유지 비용 높음
- 화면 밝기 조절로 야간 사용 부담 충분히 완화

**예외**: 향후 사용자 설문에서 다크 모드 요청 ≥ 30% 시 재검토.

---

## 2. Typography

### 2.1 Font stack
```css
--sans:  "Inter", "Pretendard Variable", ui-sans-serif, system-ui, sans-serif;
--mono:  "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
```

**❌ Serif (Instrument Serif 등) 사용 금지.**

### 2.2 Loading
Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" rel="stylesheet">
```

### 2.3 Type scale (px)
| Token | Size | Weight | Usage |
|---|---|---|---|
| `text-display` | 56–116px | 500 | Landing/Philosophy 큰 헤드라인 |
| `text-h1` | 32–42px | 500 | 화면 제목 (desktop) |
| `text-h2` | 22–28px | 500 | 섹션 제목, 중요 카운터 |
| `text-h3` | 18–22px | 500–600 | 서브섹션 |
| `text-body-lg` | 16.5–18px | 400 | 긴 본문 (Philosophy) |
| `text-body` | 14.5–15px | 400 | 일반 본문 |
| `text-body-sm` | 13–13.5px | 400 | 보조 본문 |
| `text-caption` | 11–12.5px | 400–500 | 캡션, 메타 |
| `text-mono-sm` | 10–11px | 500 | 라벨 (uppercase, letter-spacing 0.14em) |
| `text-mono-xs` | 9.5–10px | 600 | 미니 라벨 |

### 2.4 Letter-spacing 규칙
- Display/H1: `-0.025em ~ -0.045em`
- H2: `-0.02em`
- Body: `-0.005em`
- Mono uppercase: `0.06em ~ 0.14em`
- Mono numeric: `-0.005em ~ -0.02em`

### 2.5 Numerical settings
```css
font-feature-settings: "ss01", "cv11";  /* Inter stylistic sets */
font-variant-numeric: tabular-nums;     /* monospace numbers in mono class */
```

`.mono` 클래스에는 항상 `font-variant-numeric: tabular-nums` 추가.

---

## 3. Spacing

### 3.1 Scale (4px base)
| Token | px | Usage |
|---|---|---|
| `space-1` | 4 | 미세 간격 |
| `space-2` | 8 | 컴팩트 간격 (chip 사이) |
| `space-3` | 12 | 기본 간격 |
| `space-4` | 16 | 표준 간격 |
| `space-5` | 20 | 모바일 섹션 padding |
| `space-6` | 24 | 데스크톱 섹션 padding |
| `space-8` | 32 | 큰 섹션 |
| `space-10` | 40 | 큰 여백 |
| `space-12` | 48 | hero 패딩 |
| `space-16` | 64 | 화면 분리 |

### 3.2 Container widths
- Mobile frame: `360px` (실제 디자인은 `380px` device chrome 포함)
- Desktop max: `1408px` (frame), `1240px` (content), `780px` (article)
- Sidebar: `220px`
- Detail panel: `280–420px`

---

## 4. Borders

### 4.1 Radius
```css
--r-0:  0;       /* 기본 — 모든 박스, 카드 */
--r-sm: 2px;     /* 미세 */
--r-md: 4px;     /* 인터랙티브 (input, button) — 최대치 */
```

**❌ `border-radius: 8px` 이상 사용 금지** (단, 진짜 필요한 곳: 아바타 원형은 `50%` OK).

### 4.2 Width
```css
--bw-hair:  1px;  /* hairline (--hair 색) */
--bw-line:  1px;  /* default line (--line 색) */
--bw-bold:  1px;  /* solid emphasis (--ink 색) */
--bw-strip: 2px;  /* 좌측 컬러 스트립 (인박스 카드 등) */
--bw-under: 1.5px; /* 에너지 시스템 underline */
```

### 4.3 Border styles
- 기본: `solid`
- 분리선: `dashed` (행 사이 옅은 구분 시)
- 정렬용: `dotted` (timeline 마커 등)

---

## 5. Shadows

**❌ 그림자 거의 사용 안 함.** 시각 위계는 색·border·여백으로.

### 5.1 허용된 사용 케이스
```css
/* Frame shadow (모바일/데스크톱 미리보기 외부) */
.shadow-frame:    box-shadow: 0 40px 100px -30px rgba(0,0,0,0.22), 0 10px 30px -10px rgba(0,0,0,0.12);

/* 활성 카드 (호버 시 미세 들어올림 — 선택사항) */
.shadow-subtle:   box-shadow: 0 1px 2px rgba(0,0,0,0.04);
```

---

## 6. Z-index

| Layer | z-index | Usage |
|---|---|---|
| `z-base` | 0 | 기본 |
| `z-sticky` | 10 | sticky bottom bar |
| `z-overlay` | 50 | 오버레이 |
| `z-modal` | 100 | 모달, top nav |
| `z-toast` | 200 | 토스트 |
| `z-tooltip` | 300 | 툴팁 |

---

## 7. Animation

### 7.1 Easing
```css
--ease-default: cubic-bezier(0.2, 0.0, 0.2, 1.0);
--ease-out:     cubic-bezier(0.16, 1, 0.3, 1);
--ease-in:      cubic-bezier(0.7, 0, 0.84, 0);
```

### 7.2 Duration
| Token | ms | Usage |
|---|---|---|
| `dur-instant` | 80 | 호버 |
| `dur-fast` | 150 | 색 변경, 작은 transition |
| `dur-base` | 200 | 기본 transition |
| `dur-slow` | 300 | 큰 위치 변경 |
| `dur-slower` | 500 | 페이지 전환 |

**❌ `bounce`, `elastic` 등 튀는 easing 금지. `particle effect` 금지.**

### 7.3 허용된 애니메이션
- Color/opacity transition
- Underline grow on hover
- Loading dots bounce (chat typing indicator)
- Sticky bar slide-up
- Modal fade-in

---

## 8. Tailwind config 예시

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:        '#FAFAF7',
        surface:   '#FFFFFF',
        'surface-2': '#F4F3EE',
        ink:       '#0E1412',
        'ink-2':   '#2B3330',
        'ink-3':   '#5F6965',
        'ink-4':   '#8F9894',
        line:      '#D9D6CE',
        'line-2':  '#BFBBB0',
        hair:      '#E8E6DF',
        brand:     '#0D5F5A',
        'brand-ink': '#07302E',
        ok:        '#1F7A3A',
        warn:      '#B4530C',
        err:       '#A11F1F',
        info:      '#1D4ED8',
        unc:       '#6B3FB0',
        // Energy systems — 4 tier (strong / mid / text / wash)
        'e-base-strong': '#2A6396', 'e-base': '#4A8FC7', 'e-base-text': '#1D4E75', 'e-base-wash': '#E8F0F7',
        'e-lt-strong':   '#8A7818', 'e-lt':   '#B8A024', 'e-lt-text':   '#7A6A1A', 'e-lt-wash':   '#F4F0DB',
        'e-vo2-strong':  '#9E5A14', 'e-vo2':  '#C7761C', 'e-vo2-text':  '#8A4A1C', 'e-vo2-wash':  '#F7E9D9',
        'e-gly-strong':  '#8E2421', 'e-gly':  '#B8332E', 'e-gly-text':  '#8A2A2A', 'e-gly-wash':  '#F2DAD8',
        'e-atp-strong':  '#5A2D8A', 'e-atp':  '#7A3FB5', 'e-atp-text':  '#5A2F8A', 'e-atp-wash':  '#EBE0F5',
        'e-rest-strong': '#4A4A45', 'e-rest': '#7A7A70', 'e-rest-text': '#5A5A55', 'e-rest-wash': '#EFEEEA',
      },
      fontFamily: {
        sans: ['Inter', 'Pretendard Variable', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // 14.5 / 13.5 등 0.5px 단위 사용에 주의 — 디자인의 의도된 정밀함
      },
      borderRadius: {
        DEFAULT: '0',
        sm: '2px',
        md: '4px',
      },
      letterSpacing: {
        'tighter-2': '-0.025em',
        'tighter-3': '-0.035em',
        'tighter-4': '-0.045em',
        'wider-2':   '0.06em',
        'widest-2':  '0.14em',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.2, 0, 0.2, 1)',
        out:     'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

---

## 9. Global CSS

```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-feature-settings: "ss01", "cv11";
    -webkit-font-smoothing: antialiased;
  }
  body {
    @apply bg-bg text-ink font-sans;
    font-size: 14.5px;
    line-height: 1.55;
  }
  .mono {
    @apply font-mono;
    font-variant-numeric: tabular-nums;
  }
}

@layer components {
  /* Energy tag — Tier 3 (Subtle, 본문 안 inline) */
  .etag {
    @apply inline-flex items-center gap-1.5;
  }
  .etag .dot {
    @apply w-[7px] h-[7px] rounded-full flex-shrink-0;
  }
  .etag .code {
    @apply font-mono text-[11px] font-semibold tracking-wider-2;
  }
  .etag .name {
    @apply font-sans text-[12.5px] font-medium pb-px border-b-[1.5px];
  }

  /* Energy strip — Tier 1 (Strong, 좌측 4–6px 컬러바, Calendar 셀 등) */
  .estrip {
    /* width: 4–6px, background: var(--e-{system}-strong) — 인라인 또는 modifier로 지정 */
    @apply w-[4px] flex-shrink-0;
  }
  .estrip-base { background: var(--e-base-strong); }
  .estrip-lt   { background: var(--e-lt-strong); }
  .estrip-vo2  { background: var(--e-vo2-strong); }
  .estrip-gly  { background: var(--e-gly-strong); }
  .estrip-atp  { background: var(--e-atp-strong); }
  .estrip-rest { background: var(--e-rest-strong); }

  /* Energy wash — Tier 4 (선택 상태, 컨텍스트 배경 5%) */
  .ewash-base { background: var(--e-base-wash); }
  .ewash-lt   { background: var(--e-lt-wash); }
  .ewash-vo2  { background: var(--e-vo2-wash); }
  .ewash-gly  { background: var(--e-gly-wash); }
  .ewash-atp  { background: var(--e-atp-wash); }
  .ewash-rest { background: var(--e-rest-wash); }

  /* Verdict chip (AI) */
  .verdict {
    @apply font-mono text-[10px] uppercase tracking-widest-2 font-semibold pb-px border-b-[1.5px];
  }
  .verdict-confirm   { @apply text-ok border-ok; }
  .verdict-recommend { @apply text-brand border-brand; }
  .verdict-unc       { @apply text-unc border-unc; }
  .verdict-lack      { @apply text-warn border-warn; }
}
```

---

## 10. 검증 체크리스트

새 컴포넌트 만들 때 확인:

- [ ] `border-radius` 4px 이하 또는 0?
- [ ] 그림자 없음 (또는 hairline 수준만)?
- [ ] 폰트는 Inter / Pretendard / JetBrains Mono 만?
- [ ] Serif 폰트 없음?
- [ ] 에너지 시스템 색을 사용한다면 **Tier 1–4 중 어디에 해당하는지 명시**?
- [ ] 색을 쓰는 곳에 **2자 코드(BA/LT/V2/GL/AP/RE)도 함께 표시**?
- [ ] 숫자에 `tabular-nums` 적용?
- [ ] 모노스페이스 라벨에 `tracking-wider-2` 또는 그 이상?
- [ ] 터치 타깃 ≥ 44px?
- [ ] 인터랙티브 요소에 호버 상태?
- [ ] 강조는 색 배경이 아닌 굵기 + subtle highlighter?
