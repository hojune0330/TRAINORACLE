# SYSTEM FOUNDATIONS — 4개 핵심 시스템

> Sprint 1 산출물. "민지의 하루" 시연 화면이 이 문서 위에 그려진다.
> 각 시스템은 모든 화면에 흐르는 **횡단 레이어**다. 화면 단위가 아니다.

---

## 0. 제품 정체성 (재정의)

### 0.1 What this is
> **"누구나 AI 코치 장호준을 가질 수 있는 도구"**

- AI 장호준 = **그 자체가 코치** (보조 X)
- 사용자는 1명 (선수 또는 코치 본인)
- 인간 코치가 있다면 **추가** 레이어 (없어도 작동)
- 1:1 관계 — AI ↔ 사용자

### 0.2 Trinity — 사용자가 매일 느껴야 할 3가지

1. **"이 코치는 나를 안다"** — 메모리, 호명, 컨텍스트 인지
2. **"이 코치는 살아있다"** — 새 지식 반영, 대화 누적, 모드 전환
3. **"이건 내 이야기다"** — Personal archive, narrative, 시간 누적 시각화

이 3가지가 안 느껴지면 일반 fitness app과 다를 게 없다.

---

## 시스템 1 · IDENTITY

### 1.1 AI 장호준 페르소나

**이름**: 장호준 (Jang Hojune)
**호칭**: "장호준 AI" (공식), "코치 장호준" (대화 안에서)
**시각 마크**: 모노 그래픽 사인 — 이름 첫 글자가 아닌 **점(●) + JH** 모노 마크
**일러스트/아바타**: 사용 안 함 (사람 그림 X — 신뢰성 ↓ 위험)

**톤 (3 layer)**:
- **Layer A** — 사실 진술: 모노 + 정밀 (수치, 출처)
- **Layer B** — 권장/판단: sans + 차분, 이유 설명, 단정 X
- **Layer C** — 인간적 인사: sans + 짧음, 1줄 이내, 감정 X 사실 O

**예시**:
- ❌ "오늘 컨디션이 좋으세요!" (감정 가정)
- ✅ "어제 RPE 6, 수면 7시간. 지난 14일 평균과 같음."
- ✅ "오늘 PM, 6×1000m을 권장합니다. 마지막 2 rep에서 페이스 drift를 봅니다."

### 1.2 사용자 호명

| 시점 | 호칭 | 예 |
|---|---|---|
| 첫 진입 (오전) | 이름 + "님" | "민지님, 화요일 06:30입니다." |
| 일상 메시지 | 이름만 | "민지, 어제 6×1000m 잘 끝냈어요." |
| 알림 | 이름 + "님" | "민지님, 오늘 PM 세션이 8시간 후입니다." |
| AI 대화 | 이름 (대화체) | "민지, 그 질문은 좋은 지점이에요." |

→ **"민지" 단독 호명은 친근감의 핵심.** "님"을 항상 붙이면 거리감 생김.

### 1.3 Memory Display — "AI가 기억하는 것"

AI가 단순 챗봇이 아니라 **장기 기억**을 갖는다는 신호:

- 매 대화 시작에 컨텍스트 chip 표시:
  ```
  Context · 민지 · Cycle 7 · D5/9.5 · 어제 Z2 5.8km · 무릎 통증 3/5
  ```
- 모든 화면 상단 또는 측면에 작은 메모리 chip
- "지난주" / "지난 사이클" 회상 자동 삽입
- AI 대화에서 이전 대화 참조 ("지난 화요일에 물으셨던 그 페이스 분배")

### 1.4 Conversation as Archive

대화는 **사라지지 않는다**. 모든 대화는 **시간순 누적**되어 "내 코치와 나눈 역사"가 된다.

- AI Chat 화면에 좌측 또는 우측에 **"All conversations"** 시간순 리스트
- 각 대화는 검색 가능
- "이 대화에서 결정한 것"이 다른 화면(세션, 인박스)과 양방향 연결

### 1.5 Personal Archive

별도 화면 (SCREENS.md 추가될 것) — **"내 이야기"**:
- 시작일부터 누적된 모든 세션
- PB 갱신 timeline
- 부상·복귀 기록
- AI와의 주요 결정들
- "1년 전 오늘" 회상

**핵심**: 사용자는 이 archive를 "자기 자신"으로 느낀다. 이게 데이터를 떠날 수 없게 만드는 lock-in.

---

## 시스템 2 · VISUALIZATION

### 2.1 색상 시스템 강화 (이전 v2의 약점 보완)

이전 v2는 점·코드·언더라인만 썼다. 너무 약했다. 이제 **컨텍스트별 강도**를 다르게 둔다.

#### 사용 컨텍스트 4단계

**Tier 1 — Strong (즉시 인식)**
공간을 점유하고 1초 안에 분류돼야 하는 곳:
- Calendar 셀 (사이클 / 위크 뷰)
- Session card (좌측 4-6px 컬러바)
- Session hero (큰 영역)
- Cohort compare grid

**Tier 2 — Mid (분류 명확하되 본문 흐름 유지)**
- Analysis chart (line / bar / distribution)
- Energy distribution stack
- Weekly summary visual

**Tier 3 — Subtle (라벨, 인용, 메타)**
- Inline tag (현재 v2의 점·코드·언더라인)
- Mini chip
- 본문 내 reference

**Tier 4 — Wash (배경, 컨텍스트 기반)**
- 카드 배경 5% wash
- Today highlight
- Selected state

#### 에너지 시스템 색상 표 (4단계 모두)

| System | Code | Mark | Strong | Mid | Subtle (text) | Wash 5% |
|---|---|---|---|---|---|---|
| BASE Z1-Z2 | BA | ● | `#2A6396` | `#4A8FC7` | `#1D4E75` | `#E8F0F7` |
| LT Z3-Z4 | LT | ● | `#8A7818` | `#B8A024` | `#7A6A1A` | `#F4F0DB` |
| VO2 Z5 | V2 | ● | `#9E5A14` | `#C7761C` | `#8A4A1C` | `#F7E9D9` |
| GLY Z6 | GL | ● | `#8E2421` | `#B8332E` | `#8A2A2A` | `#F2DAD8` |
| ATP Z7 | AP | ● | `#5A2D8A` | `#7A3FB5` | `#5A2F8A` | `#EBE0F5` |
| REST | RE | ● | `#4A4A45` | `#7A7A70` | `#5A5A55` | `#EFEEEA` |
| MIXED | MX | ● | `#3A4340` | `#5F6965` | `#3A4340` | `#EAE9E3` |

→ **CSS variable**:
```css
--e-base-strong: #2A6396; --e-base-mid: #4A8FC7; --e-base-text: #1D4E75; --e-base-wash: #E8F0F7;
--e-lt-strong:   #8A7818; --e-lt-mid:   #B8A024; --e-lt-text:   #7A6A1A; --e-lt-wash:   #F4F0DB;
--e-vo2-strong:  #9E5A14; --e-vo2-mid:  #C7761C; --e-vo2-text:  #8A4A1C; --e-vo2-wash:  #F7E9D9;
--e-gly-strong:  #8E2421; --e-gly-mid:  #B8332E; --e-gly-text:  #8A2A2A; --e-gly-wash:  #F2DAD8;
--e-atp-strong:  #5A2D8A; --e-atp-mid:  #7A3FB5; --e-atp-text:  #5A2F8A; --e-atp-wash:  #EBE0F5;
--e-rest-strong: #4A4A45; --e-rest-mid: #7A7A70; --e-rest-text: #5A5A55; --e-rest-wash: #EFEEEA;
```

### 2.2 Pattern (색맹 대응 + 강화)

색만 사용하지 않는다. **색 + 코드 + 위치/모양** 3중 인코딩:
- 색 (color)
- 2자 모노 코드 (code)
- 도트 위치 (앞/뒤/위/아래에 따라 카테고리)
- 패턴 (점선 / 실선 / 점) — 차트에서

### 2.3 차트 타입 라이브러리

Sprint 2에서 풀 디자인. Sprint 1에선 목록만:

| Type | 사용처 | 크기 |
|---|---|---|
| Sparkline | KPI 옆 mini | 80×24 |
| Line single | 단일 추세 | 280×120 ~ 800×280 |
| Line multi | CTL/ATL/TSB | 800×280 |
| Bar | HR drift, weekly TSS | 360×280 |
| Bar with target band | 비교 | 360×280 |
| Heatmap | 14×52 weeks (calendar heat) | 728×196 |
| Distribution stack | Energy mix | 100% width × 14 |
| Density scatter | Pace × HR | 360×360 |
| Gauge | Cycle progress | 120×120 |
| Curve compare | This vs Last | 800×280 |
| Anomaly markers | dot overlay | overlay |
| Period bar | Periodization timeline | 100% × 80 |

### 2.4 Comparison Mode

거의 모든 시각화에 비교 토글:
- vs **어제** (어제 같은 시간)
- vs **지난주** 같은 요일
- vs **지난 사이클** (D-N 매칭)
- vs **작년 같은 시기**

비교 표시:
- 두 색 (current = ink, prev = ink-3)
- delta 표기 옆에 (`+12%`, `-3"`)
- 색은 의미 부여 X (좋다/나쁘다 판단 X, 사용자가 결정)

### 2.5 Drill-down

집계 → 세부:
- CTL 클릭 → 일별 contribution chart
- 주간 TSS 클릭 → 7일 세션별 분해
- Energy mix 클릭 → 사이클별 비율 변화

→ 모든 통계 숫자는 **클릭 가능해야 함**.

---

## 시스템 3 · TRUST

### 3.1 4-Tier Trust Layer

모든 AI 발언은 다음 4단계로 검증 가능:

**Tier A — Verdict + Confidence (이미 있음, 강화)**
```
[VERDICT 칩] [신뢰도 %]
```
- Verdict 4종: CONFIRM / RECOMMEND / UNC / LACK
- Confidence: 0-100%, 수치 + 시각 bar

**Tier B — Source Citation (4 종류 명시)**
인용 [N] 클릭 시 출처 종류별로 다르게 표시:
| Tier | 종류 | Mark | 가중치 |
|---|---|---|---|
| 1 | Coach Jang's Note (A_guide) | `[J]` | 가장 권위 |
| 2 | Peer-reviewed paper (Daniels 등) | `[P]` | 높음 |
| 3 | Your own data | `[Y]` | 개인화 |
| 4 | Cohort data (anonymized, opt-in) | `[C]` | 낮음 (참고) |

각 인용은 클릭 시 **원문 일부 발췌** 표시 (1-2 문장).

**Tier C — Process Trace ("AI가 본 것")**
응답 끝에 expandable section:
```
▾ AI가 참고한 데이터 (12)
  · 어제 Z2 세션 (HR 138, drift 2.1%)
  · 지난 14일 RPE 평균 (5.8/10)
  · 지난 14일 sleep 평균 (7h 02m)
  · CK 추세 (14d, +18%)
  · ... (8개 더)
  · 적용 규칙: A_guide §4 (회복 신호 충돌)
```
→ 사용자는 AI의 input을 검증할 수 있다.

**Tier D — Track Record**
AI의 과거 성적표:
```
이 종류 추천(VO2 강도 조정)의
지난 30일 동의율: 84% (16/19)
실제 효과 일치율: 78%
```
- 코치(또는 본인) 수용 비율
- 결과 일치 비율
- 이건 "AI가 자기 점수를 공개한다"는 강한 신호

### 3.2 Update Notification ("살아있는 코치")

새 지식이 반영되면 사용자에게 명시:
- 시작 시: "이 추천은 2026-04 기준 v0.3.1 모델"
- 업데이트 후: "새 페이퍼 반영: Daniels et al. 2026 (4월 추가)"
- 다음 답변 시: "지난번엔 X로 답했는데, 새 연구로 Y가 더 적절합니다"
- "What's New" 섹션 — 업데이트 history

→ AI는 **고정된 책이 아니라 살아있는 존재**.

### 3.3 Disagreement & Alternative

모든 권장에 **반대 의견** 의무:
```
권장: 강도 -10%
└─ 다른 관점: Daniels는 -15%까지 권고
└─ 코치 본인이 다르게 판단할 근거: ...
```
사용자가 거부할 길을 항상 열어둔다.

### 3.4 Decision Log

사용자가 AI 추천을 **수용 / 수정 / 거부**한 모든 이력:
- 별도 화면 (Knowledge / Coach's Notes 안)
- 시간순
- 결과까지 추적 ("거부 후 1주 결과")
- AI는 이 log를 보고 사용자 패턴 학습

---

## 시스템 4 · FEEDBACK

### 4.1 Time-tier Feedback

사용자는 **6개의 시간 단위**로 피드백을 받는다:

| Tier | 주기 | 트리거 | 산출물 |
|---|---|---|---|
| **Realtime** | 즉시 | 데이터 입력, 세션 완료 | AI 1-line comment |
| **Daily** | 매일 06:00 | 자동 | 오늘 브리프 + 어제 요약 |
| **Weekly** | 매주 월 06:00 | 자동 | Week Review (별도 화면) |
| **Cycle** | 9.5일마다 | 자동 (사이클 완료 시) | Cycle Report |
| **Monthly** | 매달 1일 | 자동 | Monthly Trend Recap |
| **Season** | 시즌 종료 | 자동 또는 사용자 트리거 | Season Story |

→ **각 tier마다 디자인 패턴 다르다.** Realtime은 짧음. Season은 long-read narrative.

### 4.2 Mode System (5개)

AI는 사용자 상태에 따라 **모드**가 전환된다. 사용자에게도 명시.

| Mode | 트리거 | AI 톤 | 시각 강조 | 알림 빈도 |
|---|---|---|---|---|
| **Normal** | 기본 | 균형, 사실 | mid 색 | 표준 |
| **Caution** | 부상 위험 / CK +20% / 통증 입력 | 보수적, 조심 | warn 색 강조 | ↓ 줄임 |
| **Recovery** | 부상 진단 / 의도적 휴식 | 부드러움, 작은 진전 강조 | rest/blue 색 | 안심 위주 |
| **Race Week** | D-7 ~ D-day | 집중, 정보 압축 | brand 강조 | 핵심만 |
| **Off-season** | 시즌 종료 후 | 풀어줌, 압박 X | 채도 ↓ | 낮은 빈도 |

#### Mode 전환 신호 (시각)

화면 상단에 **Mode chip** (단, 작게 — 부담 X):
```
NORMAL          (subtle)
CAUTION ⚠       (warn 색, 진해짐)
RECOVERY        (blue, 부드러움)
RACE WEEK ▲     (brand, 진해짐)
OFF-SEASON      (회색, 채도 ↓)
```

각 모드별 **배경 wash** 약간 변경 (1-2% 차이) — 무의식적으로 분위기 인식.

### 4.3 Notification Rules

#### 무조건 보낸다
- 매일 06:00: 오늘 브리프
- 세션 1시간 전: "곧 시작"
- 사이클 완료: 사이클 리포트
- 대회 D-7: race week 모드 전환

#### 조건부
- 부상 위험 감지 → **즉시** (Caution mode 진입)
- AI 신뢰도 < 70% → 인박스 (즉시 알림 X)
- 14일 평균 큰 변화 → 다음 주간 리뷰에 포함

#### 절대 안 보낸다
- "잘하고 있어요!" 같은 격려
- "X일 연속 운동 중!" 같은 streak 자랑
- 친구 활동 (소셜 X)
- 광고

### 4.4 Auto-narrative Layer

매 화면, 매 통계 옆에 **1줄 narrative**:

```
CTL 62.4
└─ "지난 분기 대비 +12%. 시즌 시작 이후 가장 높음."

오른 무릎 통증 3/5
└─ "이번 사이클 들어 처음. 어제 1/5에서 증가."

5000m PB 16:10.44
└─ "1년 전 16:42에서 32초 단축."
```

→ **사실 기반 narrative만**. 감정 표현 X.

---

## "민지의 하루" 시연 — 6컷 구조

이 4 시스템이 한 사용자의 하루에 어떻게 짜이는지:

| 컷 | 시간 | 화면 | Identity | Visual | Trust | Feedback |
|---|---|---|---|---|---|---|
| **1** | 06:30 | 알람 → 잠금화면 | 호명 | mode chip | — | Daily push |
| **2** | 06:32 | 앱 진입, Today | 호명 + memory | session card strong | 어제 결과 confidence | Daily brief |
| **3** | 06:35 | Daily check-in | "민지" 대화체 | body diagram strong | — | Realtime comment |
| **4** | 14:20 | AI 대화 (점심시간) | 컨텍스트 표시 | inline subtle | verdict + sources [J][Y] | Realtime |
| **5** | 22:30 | 세션 완료 → 결과 | "수고했어" tone | result chart mid + comparison | track record | Realtime + Daily 다음날 |
| **6** | 23:00 | 잠자기 전 archive | "이번 사이클 D5" | personal timeline | history | — |

각 컷에서 4 시스템이 동시에 작동한다. **이 한 화면이 "분위기" 기준점**이 된다.
