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

### 1.4 Energy systems (dot/underline ONLY — never as background)
```css
--e-base:  #4A8FC7;  /* Z1-Z2 Aerobic base */
--e-lt:    #B8A024;  /* Z3-Z4 Lactate Threshold */
--e-vo2:   #C7761C;  /* Z5 VO2max */
--e-gly:   #B8332E;  /* Z6 Glycolytic */
--e-atp:   #7A3FB5;  /* Z7 ATP-PC */
--e-rest:  #7A7A70;  /* Recovery / off */
```

**규칙: 이 색들은 7px 도트 + 1.5px underline에만 사용. 배경 색으로 사용 금지.**

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
        'e-base':  '#4A8FC7',
        'e-lt':    '#B8A024',
        'e-vo2':   '#C7761C',
        'e-gly':   '#B8332E',
        'e-atp':   '#7A3FB5',
        'e-rest':  '#7A7A70',
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
  /* Energy tag */
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
- [ ] 채도 높은 컬러 배경 박스 없음?
- [ ] 숫자에 `tabular-nums` 적용?
- [ ] 모노스페이스 라벨에 `tracking-wider-2` 또는 그 이상?
- [ ] 터치 타깃 ≥ 44px?
- [ ] 인터랙티브 요소에 호버 상태?
- [ ] 강조는 색 배경이 아닌 굵기 + subtle highlighter?
