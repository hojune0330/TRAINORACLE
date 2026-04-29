# DESIGN DECISIONS — 디자인 의사결정 기록

> **이 문서는 "왜 이렇게 디자인됐는지"를 정리합니다. CONVERSATION_LOG는 시간순 흐름, 이 문서는 결정만 압축.**

---

## 1. 시각 정체성

### 1.1 Brand color: Deep Teal `#0D5F5A`
- **3가지 옵션 검토**: Deep Teal #0F766E / Deep Blue #1E40AF / Deep Red #7C2D12 / Off-black only
- **선택**: Deep Teal을 살짝 더 차갑게 조정한 #0D5F5A
- **이유**:
  - Blue는 너무 의료/과학적 (Lancet, Nature 톤)
  - Red는 너무 sporty (Nike, Adidas 톤)
  - Off-black은 무미건조
  - Teal은 "scrubs(의료진)"과 "pitch(경기장)" 모두를 환기시키는 유일한 색
  - 경쟁사(Strava 오렌지, TrainingPeaks 파랑) 미점유 색
- **사용 비율**: UI 전체의 5% 이하 (accent only)

### 1.2 Off-white + Charcoal
- 순백/순흑이 아닌 **#FAFAF7** (약간 따뜻한 off-white) + **#0E1412** (티얼 기 머금은 charcoal)
- 이유: 장시간 사용 시 눈 피로 감소, "scientific minimalism" 톤 일관성

### 1.3 폰트 시스템
- **Inter** (UI 본문)
- **Pretendard Variable** (한국어) — 한국어 사용 빈도 높아 필수
- **JetBrains Mono** (수치) — 페이스/HR/TSS 등 모든 숫자
- **❌ Instrument Serif 제거** — 초기 v1에서 사용했으나 "Opus-style 티남"으로 사용자가 거부. UI에서 완전 제거.

### 1.4 에너지 시스템 컬러 표기 (중요한 결정 — 갱신됨)

#### v1 → v2 → v3 진화

- **v1 (거부됨)**: 파스텔 배경 박스 + 진한 텍스트
- **v2 (보완 필요)**: 점·2자 코드·1.5px underline만, 배경 사용 금지
  - 문제: 너무 약함. Calendar/Today 카드에서 1초 분류가 안 됨
- **v3 (현재 정본, 4-tier)**: 컨텍스트별 강도 차등
  - **T1 Strong**: Calendar 셀, Session card 좌측 4–6px 컬러바, hero — 색 면적 큼
  - **T2 Mid**: 분석 차트 (line/bar/distribution)
  - **T3 Subtle**: 본문 안 점·코드·underline (v2 패턴 유지)
  - **T4 Wash**: 선택 상태, 컨텍스트 배경 5%

자세한 hex 토큰은 `design-system/DESIGN_TOKENS.md` §1.4, 사용 규칙은 `VISUALIZATION_SYSTEM.md` §3.

#### 3중 인코딩 의무
- 색 (color) — 즉시 인지
- 2자 모노 코드 (BA / LT / V2 / GL / AP / RE) — color-blind 대응
- 위치/모양 (도트 위치, 패턴) — 보조

단, 정보 과다 시 **단계적 노출** 허용 (컴팩트 모드 = 색만, 확장 = 코드 추가, 더 확장 = 위치/모양).

---

## 2. 디자인 철학 변화 (v1 → v2)

### v1 (Opus-style — 거부됨)
**특징:**
- 둥근 모서리 8–12px 기본
- 좌측 컬러 스트립 (`.wk-sess .strip { left:0; width:3px; }`)
- 모든 정보를 카드/박스로 감쌈
- 파스텔 에너지 시스템 컬러 배경
- AI 인박스 = brand-wash 배경 박스
- Instrument Serif로 "감성" 포인트
- 둥근 IconButton (30-40px)
- "어디서나 보던" AI 생성 디자인 느낌

**문제 (사용자 피드백):**
> "박스 만들 때 너가 만드는 특징이 약간 둥그면서 좌측에 색깔을 넣는 패턴이 많은데 그거 다 없애고 싶어. 오푸스 너가 만든게 너무 티나."

### v2 (Tufte × Linear — 정본)
**특징:**
- `border-radius` 기본 0, 인터랙티브만 4px 이하
- 카드 박스 → hairline + 여백 + 번호로 계층
- 좌측 컬러 스트립 → 좌측 hairline (인박스 등에만)
- 에너지 시스템 → 점·코드·underline
- 인용구 → `border-left: 2px solid var(--ink)` + sans
- `§1`, `§2` 논문식 섹션 번호
- 강조: 굵기 + subtle highlighter (linear-gradient transparent 62%)
- 데이터 → 카드 4개 그리드 → **테이블** 또는 가로 4분할 구분선

### 적용 화면
| 화면 | v1 | v2 |
|---|---|---|
| Moodboard | ✅ (참고용) | — |
| Dashboard | ✅ (재작업 필요) | ⚠️ |
| Calendar | ✅ (재작업 필요) | ⚠️ |
| Session Detail | (deprecated) | ✅ 정본 |
| AI Chat | — | ✅ |
| Analysis | — | ✅ |
| AI Inbox | — | ✅ |
| Daily Check-in | — | ✅ |
| Competitions | — | ✅ |
| Onboarding | — | ✅ |
| Settings | — | ✅ |
| Philosophy | — | ✅ |
| Landing | — | ✅ |

---

## 3. 정보 구조 결정

### 3.1 Session Detail 정보 블록 순서
1. Header (날짜, Day, 뒤로가기)
2. Hero (태그, 제목, 목적, 메타 4개, 카운트다운)
3. **Why? (철학) ← 데이터보다 먼저** ★ 차별화
4. Protocol (3 phases)
5. Validation (9 Rules)
6. AI 인박스 연동
7. Cycle context (관련 세션)
8. Sticky action bar (Mobile) / Right column (Desktop)

**Why 섹션을 데이터 위에 둔 이유**: brief의 "evidence-first, why-based" 원칙. 페이스만 보면 그냥 인터벌 트레이닝 앱.

### 3.2 AI Chat 응답 구조 (가장 중요)
모든 AI 응답은 다음 구조 따름:
```
[Verdict 칩] [신뢰도 %]
└─ Lead 답변 (요약, sup태그 [1] 인용)
└─ 데이터 테이블 (mono, hairline)
└─ 추가 설명 (인용 추가)
└─ 다른 관점 (alternative view) ← 반드시 포함
└─ Sources (확장 가능)
└─ Actions (저장 / 적용 / 코치판단입력)
```

### 3.3 AI Inbox 카테고리 (5개)
| 코드 | 이름 | 색 | 트리거 |
|---|---|---|---|
| UNC | 판정 불확실 | --unc (보라) | confidence < 70% |
| RISK | 부상 위험 | --warn (주황) | 패턴 + 통증 입력 |
| PTRN | 패턴 감지 | --info (파랑) | 14일 추세 변화 |
| RULE | 규칙 위반 | --warn | 9 Rules 자동 검증 fail |
| PASS | 규칙 통과 | --ok (녹색) | 사이클 완료 시 |

### 3.4 Calendar 3-View
- **Week** — Garmin/TP 사용자가 익숙한 7×2(AM/PM) 그리드
- **9.5-Cycle** ★ — 10-slot rail, MAIN 중심 — **차별화 포인트**
- **Timeline** — 3개월 macro view, 코치용

→ Mobile 기본은 9.5-Cycle 뷰 (제품 정체성 강조).

---

## 4. 컴포넌트 패턴 (재사용 가능)

### 4.1 Section Header
```html
<div class="sec-head">
  <span class="sec-no"><b>§3</b> · Protocol</span>
  <span class="sec-act">편집</span>
</div>
```
- `§N`: 모노 + ink-3
- 제목: 굵기 500
- 우측 액션: 모노 + underline

### 4.2 Data table (cards 대체)
카드 4개 그리드 → 테이블 또는 4분할 행으로 변경. 이유: scientific 톤, 정렬된 숫자가 코치에게 더 읽기 쉬움.

### 4.3 Validation item (체크 표시)
```
✓  R-6   VO2 반복 볼륨 기준 내
        6 × 1000m = 6 km · 권고 5–8 km
```
- 색 칩 박스 X
- 마크 + 코드 + 제목 + sub

### 4.4 AI message (좌측 hairline)
```
| 장호준 AI · 판정 불확실 · 신뢰도 72%
| ─────────────────────────
| 답변 본문 [1] [2]
| ...
```
- 좌측 2px brand 선
- 본문 padding-left 14px

### 4.5 Sources (footnote 스타일)
```
[1] A_guide Rule 4 — 회복 신호 충돌
    Coach Jang · 2023 · §4.2                         open →
```
- 번호 + 제목 + sub + 링크 우측

---

## 5. 마이크로 인터랙션 결정

### 5.1 호버
- 배경 색 변화 (`var(--surface-2)`) 또는 underline
- 그림자 절대 사용 X
- transform translate 절대 사용 X (튀는 느낌)

### 5.2 버튼 상태
- Primary: `var(--ink)` 배경 + bg 텍스트
- Secondary: 투명 + line border
- Tertiary: 투명 + 모노 텍스트 + underline

### 5.3 로딩
- AI 응답: 3개 점 bouncing dot (brand 색)
- 페이지 전환: hairline progress bar
- 스피너 사용 X (둥근 형태 회피)

---

## 6. 거부된 기능들

### "신용카드 등록 없는 14일 무료" → 유지
초기 베타라 결제 모델 미정. 단, Landing에 "신용카드 불필요" 명시.

### Social feed (Strava 스타일) → ❌ 거부
브리프 명시. "we are not a social platform."

### Achievement badges → ❌ 거부
브리프 명시. "no gamification."

### AI 음성 응답 → 보류
나중에 검토. 처음엔 텍스트만.

### 다른 종목 (수영, 사이클) → 보류
1500-10000m 우선. 검증 후 확장.

---

## 7. 사용자 정의 변경 (재정리)

### 이전 — 코치 + 선수 양쪽
- 엘리트 선수 + 코치(8명 모니터링) + 선수+코치
- AI Inbox에 코치 view 8명 통합
- Cohort 비교 활성

### 현재 (정본) — 사용자 ↔ AI 1:1
- **1차 사용자**: 중장거리 선수 본인. 인간 코치 필수 X
- 사용자 ↔ AI 코치 장호준 1:1 관계가 중심
- Coach view (8명), Cohort 비교 등은 **B2B / P3 후순위**

자세한 변경: PHILOSOPHY.md §2 참조.

---

## 8. AI 구현 단계 (재정리)

### 현재 — Rule Engine
- 하드코딩된 코칭 지식 + 결정 함수 + 고정 피드백 템플릿
- LLM API 자유 호출 없음
- Verdict / Confidence는 모두 결정 함수 출력값
- 비용 0, hallucination 0, 일관성 100%

### 추후 — LLM 도입
- Claude API + RAG (Coach Jang notes + 본인 세션)
- Citation 검증 (server-side)
- Track Record 표시 (LLM 단계에서만)
- Stable / Latest channel 선택

자세한 차이: SAFEGUARDS.md §5 참조.

---

## 9. 기록 시스템 (4 Records)

| 종류 | 의미 |
|---|---|
| PB | 평생 최고기록 |
| SB | 시즌 최고기록 |
| Target | 목표 기록 |
| Reference | 참고 기록 (라이벌·동료) |

PB·SB는 시각화 1급 시민. Reference는 사용자 직접 입력만 (Cohort 자동 비교는 P3).
자세한 화면: `designs/SPRINT2_Records.html`.

---

## 10. 결정 / 추후 결정 필요

### 결정됨 (2026-04-29)
- **Dark mode 미지원** (원칙) — Tufte × Linear 시각 톤은 밝은 배경 전제. 다크 자동 추종도 비활성화. `<meta name="color-scheme" content="light">` 명시. (VISUALIZATION_SYSTEM §13.4)
- **MIXED(MX) 단계적 노출** — dominant<65% 시 MIXED 처리. Heatmap=dominant 단일 색, 셀=2색 split, hero=split+dual code. (VISUALIZATION_SYSTEM §13.1)
- **Cohort comparison 활성 트리거** — 종목당 ≥100명 / Pro 출시 / opt-in ≥80% 중 둘 이상. (VISUALIZATION_SYSTEM §13.2)
- **Track Record** — 현재 표시 X. LLM 단계 진입 시 A+D 조합(요약 + decision log). (VISUALIZATION_SYSTEM §13.3)
- **PB Trail 종목 토글** — chip row + 주종목 default + 종목별 독립 Y축 + 정규화 차트 옵션. (VISUALIZATION_SYSTEM §13.5)

### 미해결
- [ ] 고대비 모드 토글 (트랙용)
- [ ] 음성 입력 (Daily check-in 시)
- [ ] 다국어 외 다른 언어 (일본어, 중국어?)
- [ ] 결제 모델 (월 구독? 분리 결제? B2B?)
- [ ] LLM 단계 진입 시점 (사용자 N명 / 데이터 N건 누적 후?)
- [ ] Personal Archive 화면 디자인
