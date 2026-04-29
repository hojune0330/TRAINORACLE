# GLOSSARY — 용어집 (정본)

> **이 문서의 목적**: TRAINORACLE에서 사용하는 모든 용어를 한 곳에 모은 공식 사전.
> 훈련 전문 용어, 시스템 고유 용어, 디자인·개발 용어가 혼재되어 있어
> 사용자·외부 자문 코치·신규 합류자 모두에게 헷갈릴 수 있는 상황을 해소합니다.
>
> **사용법**:
> - **사용자**: 화면에서 본 용어가 헷갈릴 때 §1 (훈련) / §2 (시스템) 참조
> - **외부 자문 코치**: §1 (훈련) + §2 (시스템) 위주로 검토
> - **개발자**: §3 (데이터 엔티티) + §4 (디자인) + §5 (코드 인덱스)
> - **빠른 검색**: §5 약어 인덱스에서 ⌘F
>
> **정본**: 이 문서가 가장 정확합니다. 다른 문서에서 용어 정의가 다르면 이 문서가 우선합니다.
> **갱신 규칙**: 새 용어를 도입할 때는 반드시 여기 추가한 뒤 다른 문서·코드에서 사용.

---

## 0. 한영 표기 규칙 (Tone Manual)

`PHILOSOPHY.md §6`을 확장한 카피 작성 규칙입니다.

### 0.1 원칙

> **사용자(선수)가 이미 영어로 알고 있는 용어는 영어 그대로.**
> **일반 UX 문구·설명문은 자연스러운 한국어로.**

### 0.2 카테고리별 표기 규칙

| 카테고리 | 표기 | 이유 | 예 |
|---|---|---|---|
| **UI 라벨** | 한국어 | 일반 사용자 친화 | "대시보드", "캘린더", "분석", "내 이야기" |
| **일반 메시지** | 한국어 (공식 한국어) | 격식·정확성 | "좋은 아침이에요", "오늘 세션은…" |
| **훈련 용어 (zone, system)** | **영어 + 모노** | 선수가 영어로 학습함 | `VO2`, `LT`, `BASE`, `MAIN`, `Z2` |
| **훈련 약어 (성과)** | **영어 + 모노** | 국제 표준 | `PB`, `SB`, `DNF`, `DNS` |
| **측정 지표** | 영어 + 모노 + 단위 | 정밀성 | `HR 178`, `TSS 124`, `RPE 7.5` |
| **페이스·시간** | 영어 + 모노 | 변환 헷갈림 방지 | `3'20"/km`, `16:10.44`, `90 sec` |
| **규칙 코드** | 영어 + 모노 | 단축 참조 | `R-6`, `D-5`, `T-2`, `Q3` |
| **시스템 고유 명사** | 영어 (대문자 시작) | 제품 정체성 | `Personal Archive`, `PB Trail`, `9.5-Cycle`, `AI Inbox` |
| **고유 차트 명칭** | 영어 그대로 | 기능 일관성 | `Sparkline`, `Heatmap`, `PB Trail` |
| **개발 용어 (내부 문서만)** | 영어 | 개발자 간 공용어 | `Tier`, `Token`, `Hairline`, `Verdict` |

### 0.3 첫 등장 시 한국어 병기

영어 시스템 명사가 **사용자 노출 화면에서 처음** 나올 때는 한국어 부제를 짧게 병기합니다.

| 영어 | 첫 등장 표기 | 두 번째부터 |
|---|---|---|
| `Timeline` | **TIMELINE · 시간순 기록** | `Timeline` |
| `PB Trail` | **PB Trail · 최고기록 추이** | `PB Trail` |
| `9.5-Cycle` | **9.5-Cycle · 9.5일 주기** | `9.5-Cycle` |
| `Inbox` | **AI Inbox · 받은편지함** | `Inbox` |
| `Verdict` | **Verdict · 판정** | `Verdict` |
| `Confidence` | **Confidence · 신뢰도** | `Confidence` |

### 0.4 절대 피하는 표현

| 피해야 할 표현 | 이유 | 대신 |
|---|---|---|
| ~~1급 시민~~ (first-class citizen 직역) | 한국어로 어색·의미 모호 | 문맥별: "항상 우선 표시" / "핵심 데이터" / "동등 표시" |
| ~~트리거~~ (한국어 본문 안에서 음차) | 부자연스러움 | "발동", "발동 조건", "발생 시점" |
| ~~단계노출~~ | 합성 어색 | "단계적 공개", "점진 공개" |
| ~~ledger~~ (사용자 노출 라벨) | 일반 사용자에게 낯섦 | "이력", "기록부" |
| ~~채택율~~ / ~~채택 YES/NO~~ | 통계 용어, 어색 | "수용 비율", "수용/미수용" |
| ~~회수~~ (race recap 의도) | recovery와 혼동 | "원인 분석", "되짚어보면" |
| ~~화이팅~~, ~~잘했어요~~, 이모지 격려 | PHILOSOPHY §6 금지 | 사실 진술 |

### 0.5 격식

- 공식적 한국어 (반말 ✗, 너무 부드러운 ~요체 자제)
- 추측 표현 자제 (`아마도`, `~일 수 있다` → `데이터에 따르면`, `권고 기준`)
- 단정하지 않을 때는 **수치 + Verdict + Confidence**로 명시 (`Verdict UNCERTAIN · conf 72%`)

---

## 1. 훈련 용어 (Training Terminology)

### 1.1 에너지 시스템 (Energy Systems)

운동을 어떤 에너지원으로 수행하는지에 따른 분류. 화면에서 점(dot) + 코드로 표시됩니다.

#### **BASE** — Aerobic Base
- 한글 풀이: **유산소 기초 · 저강도 지속**
- 사용 맥락: 회복 조깅, 장거리 LSD (Long Slow Distance)
- 대응 Zone: `Z1–Z2`
- 표기: `BASE` (영어 + 모노 + 파란 점)
- 색: `#4A8FC7` (cool blue)
- 예: "오전 60분 Easy jog · `BASE`"

#### **LT** — Lactate Threshold
- 한글 풀이: **젖산 역치 · 중강도 지속**
- 사용 맥락: 템포 런, 임계 강도 인터벌
- 대응 Zone: `Z3–Z4 하단`
- 표기: `LT` (모노 + 황금색 점)
- 색: `#B8A024`
- 예: "20분 LT 템포 4'00"/km · HR 168"

#### **VO2** — Maximal Oxygen Uptake
- 한글 풀이: **최대산소섭취 · 고강도 인터벌**
- 사용 맥락: 1km–1.2km 반복, 5분 ON·OFF
- 대응 Zone: `Z4–Z5`
- 변형:
  - **VO2-LONG**: 긴 인터벌 (1000m–1200m, 3–5분)
  - **VO2-SHORT**: 짧은 인터벌 (400m–800m, 60–90초)
- 표기: `VO2`, `VO2-LONG`, `VO2-SHORT`
- 색: `#C7761C` (warm orange)
- 예: "6×1000m @ 3'20" · `VO2-LONG`"

#### **GLY** — Glycolytic
- 한글 풀이: **무산소 해당계 · 단거리 고강도**
- 사용 맥락: 200m–600m 전력 반복
- 변형:
  - **GLY-SHORT**: 30–90초 반복
- 표기: `GLY`, `GLY-SHORT`
- 색: `#B8332E`
- 예: "8×400m · `GLY-SHORT` · rest 3min"

#### **ATP-PC** — Adenosine Triphosphate–Phosphocreatine
- 한글 풀이: **인원질계 · 초단거리 폭발**
- 사용 맥락: strides (60–80m), 6–10초 전력 질주
- 표기: `ATP-PC` (모노 + 보라 점)
- 색: `#7A3FB5`
- 예: "6×80m strides · `ATP-PC`"

#### **REST**
- 한글 풀이: **휴식 · 비훈련일**
- 사용 맥락: rest day, mobility-only day
- 표기: `REST` (회색 점)
- 색: `#7A7A70`

### 1.2 강도 Zone (HR Zones)

심박 기반 5단계 분류. Karvonen 또는 LTHR 기반.

| Zone | 한글 풀이 | %HRmax | 주 사용 |
|---|---|---|---|
| **Z1** | 회복 / 워밍업 | 50–60 % | 회복 jog, cool-down |
| **Z2** | 유산소 기초 | 60–70 % | 장거리 base run |
| **Z3** | 템포 / 마라톤 페이스 | 70–80 % | tempo run |
| **Z4** | 임계 / LT | 80–90 % | LT interval |
| **Z5** | 최대 / VO2 | 90–100 % | VO2 interval |

- 표기: `Z1`–`Z5` (모노)
- 예: "Z1 Recovery 13% (target ≥ 15%)"

### 1.3 성과 약어 (Performance Records)

| 약어 | 영어 풀네임 | 한글 풀이 | 예 |
|---|---|---|---|
| **PB** | Personal Best | 평생 최고기록 | `5K PB 16:42.18` |
| **SB** | Season Best | 해당 시즌 최고기록 | `2026 SB 17:04` |
| **DNF** | Did Not Finish | 완주 실패 (출발했으나 중단) | `춘마 HM · DNF` |
| **DNS** | Did Not Start | 출발 포기 (등록했으나 미출전) | `한강 5K · DNS` |

- 표기: 영어 + 모노 그대로
- **원칙**: PHILOSOPHY §5.6 — DNF·DNS도 timeline에 동등 표시

### 1.4 측정 지표 (Metrics)

| 약어 | 영어 풀네임 | 한글 풀이 | 단위 | 예 |
|---|---|---|---|---|
| **HR** | Heart Rate | 심박수 | bpm | `HR 178 avg` |
| **HRmax** | Maximum HR | 최대심박수 | bpm | `HRmax 192` |
| **LTHR** | Lactate Threshold HR | 젖산역치 심박 | bpm | `LTHR 174` |
| **RPE** | Rate of Perceived Exertion | 자각운동강도 | 1–10 | `RPE 7.5` |
| **TSS** | Training Stress Score | 훈련부하 점수 | au | `TSS 124` |
| **CTL** | Chronic Training Load | 만성부하 (장기) | au | `CTL 78` |
| **ATL** | Acute Training Load | 급성부하 (단기) | au | `ATL 92` |
| **TSB** | Training Stress Balance | 부하 균형 (CTL−ATL) | au | `TSB −14` |
| **CK** | Creatine Kinase | 크레아틴 키나아제 (근피로 지표) | U/L | `CK +18%` |
| **EPOC** | Excess Post-exercise O₂ Consumption | 운동후 초과산소소비 (회복 부담) | h | `EPOC 72h` |
| **HR drift** | — | 심박 표류 (페이스 동일·HR 상승) | % | `HR drift 2.1%` |

- 표기: 영어 + 모노 + 단위
- 예: "HR 178 avg · TSS 124 · CK +18%"

### 1.5 시간·페이스 표기

| 형식 | 의미 | 예 |
|---|---|---|
| `m'ss"` | 분'초" 페이스 | `3'20"` (3분 20초) |
| `m'ss"/km` | km당 페이스 | `3'20"/km` |
| `mm:ss.ms` | 기록 시간 | `16:10.44` |
| `Ns` | 초 (rest 등) | `90s rest` |
| `Nmin` | 분 | `60min` |

### 1.6 부상·통증 (Injury Terminology)

| 약어 | 풀네임 | 한글 |
|---|---|---|
| **ITBS** | Iliotibial Band Syndrome | 장경인대 마찰 증후군 |
| **strain** | — | 근육 좌상 |
| **염좌** | sprain | 인대 손상 |
| **족저근막염** | plantar fasciitis | — |

- 표기: 한국어 본문이면 한글, 의료 라벨은 영어 + 모노

### 1.7 훈련 일정 용어

#### **MAIN session** (MAIN)
- 한글 풀이: **주요 훈련 세션 · 사이클의 핵심 자극**
- 사용 맥락: 9.5-Cycle 안에서 계획된 핵심 훈련 (보통 D2, D5, D8 등)
- 표기: `MAIN` 또는 `MAIN session` (대문자)
- 예: "Next MAIN: 8×800m VO2-LONG"

#### **AUX session** (AUX, Auxiliary)
- 한글 풀이: **보조 세션 · 회복 또는 strides 등**
- 사용 맥락: MAIN 사이의 회복·기초 세션
- 표기: `AUX`
- 예: "AM Easy 60min · `AUX`"

#### **taper**
- 한글 풀이: **테이퍼 · 대회 직전 부하 감량 기간**
- 사용 맥락: 대회 D-7 ~ D-1
- 표기: 한국어 본문에서는 `taper` 그대로 또는 "테이퍼"
- 예: "대회 D-5 · `taper` 강도"

---

## 2. 시스템 고유 용어 (TRAINORACLE-Specific)

이 절의 용어들은 TRAINORACLE이 정의한 고유 개념입니다.

### 2.1 9.5-Cycle (9.5일 주기)
- **풀이**: TRAINORACLE의 핵심 훈련 사이클 단위. 7일 주기가 아닌 **9.5일** 단위로 MAIN 세션 간격을 둠.
- **이유**: 7일 주기는 회복 부족, 14일은 자극 손실 — 9.5일이 최적이라는 코칭 정본 기반.
- **표기**: `9.5-Cycle` (영어, 첫 등장 시 "9.5일 주기" 병기)
- **D-day 기준**: 사이클 시작일을 `D1`, 끝을 `D9.5`로 표현
- **예**: "Cycle 7 · Day 5/9.5 · 다음 MAIN D8"

### 2.2 9 Rules (9가지 검증 규칙)
- **풀이**: 매일 훈련을 데이터로 검증하는 9개의 규칙. 결과는 **PASS / WARN / FAIL** 또는 **OK / WARN / ERR**로 표시.
- **표기**: `R-1`–`R-9` (모노)
- **예시**:
  - `R-1` Energy Balance — 에너지 시스템 분포 균형
  - `R-2` MAIN Interval — MAIN 간격 9.5±1.5일 유지
  - `R-3` Z1 Recovery — Z1 비율 ≥ 15%
  - `R-4` EPOC Recovery — 회복 시간 충족
  - `R-5` Weekly Volume — 주간 볼륨 목표 범위
  - `R-6` Pace Regression — 페이스 후퇴 감지
  - (그 외 R-7, R-8, R-9 — VISUALIZATION_SYSTEM.md 참조)
- **문서 정본**: `design-system/SYSTEM_FOUNDATIONS.md`

### 2.3 D-N rules (Day-N rules)
- **풀이**: 사이클 안의 특정 D-day에 발동되는 규칙. 예: `D-9 rule`은 사이클 9일째 무리한 부하 시 사전 경고.
- **표기**: `D-9`, `D-5` 등 (모노)
- **예**: "D-9 rule 사전 경고: 있었음 (미수용)"

### 2.4 T-N rules (Trigger rules)
- **풀이**: 특정 조건이 충족되면 발동되는 규칙. 예: `T-2`는 Cohort 비교 발동 조건.
- **표기**: `T-2` 등 (모노)

### 2.5 Verdict · 판정
- **풀이**: AI 판단 결과. 4단계.
- **표기**: 영어 대문자, 첫 등장 시 "Verdict · 판정" 병기

| 값 | 한국어 | 의미 |
|---|---|---|
| `RECOMMEND` | 권고 | 명확한 권장 |
| `UNCERTAIN` | 판정 불확실 | conf < 0.5 또는 데이터 충돌 |
| `WARN` | 경고 | 부상·과부하 위험 신호 |
| `LACK` | 데이터 부족 | 결정 불가, 추정 금지 |

- 예: "Verdict `UNCERTAIN` · conf 72%"

### 2.6 Confidence · 신뢰도
- **풀이**: AI가 자기 판정에 대해 매기는 신뢰도. `0.0`–`1.0` 또는 `0`–`100%`.
- **원칙**: `< 0.5`이면 `LACK` 또는 `UNCERTAIN` 반환 (PHILOSOPHY §7 Honest API)
- **표기**: `conf 72%` 또는 `confidence 0.72`

### 2.7 4 Records (4가지 기록 시스템)
사용자에게 받는 핵심 기록 4개. 모든 추천·검증의 기준점.

| 약어 | 영어 풀네임 | 한국어 | 예 |
|---|---|---|---|
| **PB** | Personal Best | 평생 최고기록 | 5000m 16:10.44 |
| **SB** | Season Best | 해당 시즌 최고기록 | 2026 시즌 1500m 4:13.55 |
| **Target** | — | 목표 기록 | 1500m 4:12.00 |
| **Reference** | — | 참고 기록 (라이벌·동료) | 동료 5000m 15:50 |

- **원칙**: PB·SB·Target·Reference 모두 **동등 표시** — 어느 하나가 다른 것에 종속되지 않고 동시 노출
- **참조**: `PHILOSOPHY.md §5.5`, `designs/SPRINT2_Records.html`

### 2.8 PB Trail · 최고기록 추이
- **풀이**: PB가 시간에 따라 어떻게 갱신되어 왔는지 보여주는 시계열 차트. 종목별 (1500m / 5000m / 10K / HM / 마라톤)로 별도.
- **시각 요소**:
  - 계단형 step path (PB가 갱신될 때만 내려감)
  - 후퇴(regression) 마커 (`#B4530C`)
  - DNF·injury 마커 (점선 vertical)
  - target line (`16:00` 등 목표 점선)
- **표기**: 영어 그대로, 첫 등장 시 "PB Trail · 최고기록 추이"
- **참조**: `design-system/VISUALIZATION_SYSTEM.md §13`, `designs/13_PersonalArchive.html`

### 2.9 Personal Archive · "내 이야기"
- **풀이**: 시작일부터 모든 기록을 시간순으로 그대로 보존하는 개인 아카이브 화면.
- **원칙**:
  - 편집·삭제 불가 (정정은 NOTE 추가로)
  - PB 갱신·후퇴·DNF·DNS·부상 모두 동등 노출
  - "1년 전 오늘" 회상 (default ON)
  - **감정 평가 금지** — AI는 사실만, 의미 부여는 사용자 몫
- **표기**: 한국어 화면에서는 "내 이야기", 시스템 라벨은 `Personal Archive`
- **참조**: `PHILOSOPHY.md §5.6`, `designs/13_PersonalArchive.html`

### 2.10 AI Inbox · 받은편지함
- **풀이**: AI가 매일 자동 생성하는 알림·결정 항목 모음. 분류 필요 / 경고 / 권고 등.
- **항목 종류**:
  - `UNCERTAIN` (분류 필요) — 보라색
  - `WARN` (주의) — 주황색
  - `RECOMMEND` (권고) — 초록색
- **표기**: `AI Inbox`, 사용자 화면에서는 "받은편지함" 병기 가능
- **참조**: `designs/07_AIInbox.html`

### 2.11 Daily Check-in · 매일 체크인
- **풀이**: 매일 아침/저녁 사용자가 컨디션·통증·수면 등을 입력하는 짧은 체크.
- **표기**: 한국어 화면 "매일 체크인", 시스템 `Daily Check-in`
- **참조**: `designs/09_DailyCheckin.html`

### 2.12 9 Rules engine (Rule Engine)
- **풀이**: 9가지 규칙을 매일 자동 검증하는 결정 함수. TS(TypeScript) 결정 함수로 구현 예정.
- **단계**:
  1. **Rule engine 단계** — 결정론적 규칙 검증 (현재 단계)
  2. **LLM 단계** — Claude API + RAG 도입 후 자연어 코칭
- **표기**: `Rule engine` (영어, 내부 문서)

### 2.13 Track Record (Q3 결정 — 제외)
- **풀이**: 한때 검토되었던 차트 타입. 현재는 **제외 결정**됨.
- **결정 근거**: VISUALIZATION_SYSTEM.md Q3 — Rule-engine 단계의 시각화만 다룸. Track Record는 시스템 결정 단계 이후로 미룸.
- **현재 상태**: 비사용

### 2.14 Cohort 비교 (P3로 미룸)
- **풀이**: 동료/라이벌 그룹과의 비교 시각화.
- **현재 상태**: privacy 검토 후 P3+ 단계로 미룸 (B2B 단계).
- **표기**: `Cohort` (영어 그대로)

### 2.15 MIXED · 단계적 공개
- **풀이**: 한 세션이 두 에너지 시스템을 동시에 자극할 때(`dominant < 65%`) 표시 방식.
- **단계**:
  - 컴팩트 view: dominant 단일 표시
  - 셀(cell) view: 2색 split
  - hero view: split + dual code
- **표기**: `MIXED` (모노 대문자)

### 2.16 PB chip row
- **풀이**: 화면 상단에 PB를 종목별 chip으로 한 줄에 표시하는 컴포넌트.
- **결정 근거**: 시각화 결정 5번 (Q5)
- **표기**: `PB chip row` (영어, 디자인 컴포넌트 명)

---

## 3. 데이터 엔티티 (Database / Domain Models)

개발자·외부 자문 코치가 데이터 구조를 이해할 때 참조.

| 엔티티 | 한국어 풀이 | 주요 필드 |
|---|---|---|
| `User` | 계정 사용자 | email, role |
| `Athlete` | 선수 프로필 | userId, age, sex, primaryDistance |
| `Coach` | 코치 (B2B 단계) | userId, athletes[] |
| `Cycle` | 9.5일 주기 인스턴스 | startDate, mainSessions[] |
| `Session` | 단일 훈련 세션 | date, type (`MAIN`/`AUX`/`REST`), energySystem, distance, hr, pace |
| `CheckIn` | 일일 체크인 입력 | date, energy, soreness, sleep, mood |
| `InboxItem` | AI 자동 생성 알림 항목 | type (`WARN`/`UNCERTAIN`/`RECOMMEND`), ruleId, createdAt, status |
| `ChatThread` | AI 대화 스레드 | messages[], athleteId |
| `Message` | 채팅 단일 메시지 | role, content, citations |
| `Competition` | 대회 항목 | date, distance, result (time / DNF / DNS), placing |
| `ValidationResult` | 9 Rules 검증 결과 | ruleId (`R-1`~`R-9`), verdict, value, target |
| `Provider` | 외부 데이터 소스 | type (`garmin`/`strava`/`manual`), syncedAt |

- **참조**: `design-system/SYSTEM_FOUNDATIONS.md`

### 3.1 화면별 데이터 의존성
| 화면 | 필요 데이터 |
|---|---|
| Onboarding | `User`, `Athlete`, `PB[]` |
| Dashboard | `Cycle`, 오늘 `Session`, 미읽은 `InboxItem[]`, 오늘 `CheckIn` |
| Calendar | `Cycle`, `Session[]` |
| Session Detail | `Session`, `Cycle`, `ValidationResult[]`, 연관된 `InboxItem` |
| AI Chat | `ChatThread`, `Message[]`, `Athlete` 상태, Knowledge base |
| Personal Archive | 모든 `Session[]`, `InboxItem[]` (decision log), `Competition[]`, 부상 이력 |

---

## 4. 디자인·개발 용어

### 4.1 디자인 톤

#### **Tufte × Linear**
- **풀이**: TRAINORACLE의 v2 디자인 정본 톤.
  - **Tufte**: Edward Tufte의 정보 디자인 원칙 — 데이터 잉크 비율 극대화, 차트 정크 제거, 직각·표 중심
  - **Linear**: Linear.app의 UI 톤 — 깔끔한 헤어라인, 모노 대문자 라벨, 직각, 미니멀
  - **합쳐서**: 데이터 1순위, 직각·헤어라인, 점·코드만으로 표현, 라운드 없음, 그라데이션 없음, 이모지 없음
- **참조**: `DESIGN_DECISIONS.md §2`, `designs/05_SessionDetail.html` (정본)

#### **Hairline**
- **풀이**: 1px 얇은 선. 모든 구획·테이블 분할에 사용. 색은 `--line: #D9D6CE` 또는 `--hair: #E8E6DF`.
- **표기**: `hairline` (영어, 디자인 문서 내)
- **사용**: 카드 분리 대신 `border-bottom: 1px solid var(--hair)` 등

### 4.2 토큰 시스템 (Design Tokens)

#### **Token**
- **풀이**: 디자인 변수 (color, spacing, typography 등)를 의미 있는 이름으로 추상화한 값.
- **표기**: `--bg`, `--ink`, `--brand` 등 CSS custom property 형태

#### **Tier (4-tier energy color)**
- **풀이**: 에너지 시스템 색을 사용 강도에 따라 4단계로 차등.

| Tier | 이름 | 사용 | 강도 |
|---|---|---|---|
| **T1 Strong** | 강 | hero 차트 채움 | 100% |
| **T2 Mid** | 중 | 점·헤어라인 강조 | 60–70% |
| **T3 Subtle** | 미 | 본문 안 점·코드·underline | 30% |
| **T4 Wash** | 워시 | 선택 상태, 셀 highlight | 5% (배경) |

- **참조**: `design-system/DESIGN_TOKENS.md §1.4`

### 4.3 차트 타입

#### **Sparkline**
- **풀이**: 작은 인라인 미니 차트 (보통 라벨 옆에 붙는 50–100px 폭).
- **표기**: `Sparkline` (영어 그대로)

#### **Heatmap**
- **풀이**: 격자 형태로 값을 색 농도로 표현. (예: GitHub contribution graph 스타일)
- **표기**: `Heatmap` (영어 그대로)

#### **Step path**
- **풀이**: 계단형 라인. PB Trail에서 PB 갱신 시점에만 내려가는 형태.
- **표기**: `step path`

#### **Range Switcher**
- **풀이**: 시간축 차트의 범위 토글 UI (`1y / 2y / 3y / all`).
- **결정**: Q4 — 모바일도 범위 토글 가능, 단계적 확장 구조.
- **표기**: `Range Switcher` (영어 그대로)

### 4.4 컴포넌트 용어

| 영어 | 한국어 | 사용 |
|---|---|---|
| **chip** | 칩 | 작은 라벨 (PB chip, energy chip 등) |
| **dot** | 점 | 에너지 시스템 식별 점 (7px–13px) |
| **rail** | 레일 / 측면 패널 | 9.5-Cycle rail (가로 막대), 우측 sidebar |
| **stage** | 스테이지 | view-stage (프레임 안의 콘텐츠 영역) |
| **callout** | 강조 카드 | "1년 전 오늘" 등 |
| **table-style** | 표 형식 | 카드 대신 표·구획선 사용 |

### 4.5 외부 라이브러리

| 이름 | 용도 |
|---|---|
| **Visx** | React 차트 라이브러리 (D3 기반) — Analysis 화면 차트 |
| **Pretendard** | 한글 폰트 — UI 본문 |
| **Inter** | 영문 폰트 — 본문·라벨 |
| **JetBrains Mono** | 모노 폰트 — 숫자·코드·약어 |
| **Tailwind** | 유틸리티 CSS — 빌드 단계 적용 예정 |
| **Supabase** | DB·Auth — 백엔드 |
| **Claude API** | LLM — Phase 2 |

### 4.6 개발 워크플로우 용어

| 영어 | 한국어 |
|---|---|
| **정본** (canonical) | 공식 버전, 다른 문서가 충돌하면 우선 |
| **deprecated** | 폐기 (`_archive/`로 이동) |
| **REDO** | 재작업 필요 |
| **NEXT** | 다음 작업 후보 |
| **OK / PASS** | 검증 통과 |

---

## 5. 약어·코드 빠른 인덱스

⌘F로 빠르게 찾을 수 있는 평면 인덱스.

### 5.1 훈련 약어
`ATL` `ATP-PC` `AUX` `BASE` `bpm` `CK` `CTL` `DNF` `DNS` `EPOC` `GLY` `HM` `HR` `HRmax` `ITBS` `km` `LSD` `LT` `LTHR` `MAIN` `pace` `PB` `RPE` `SB` `strain` `taper` `TSB` `TSS` `VO2` `VO2-LONG` `VO2-SHORT`

### 5.2 강도 Zone
`Z1` `Z2` `Z3` `Z4` `Z5`

### 5.3 시스템 코드
- **9 Rules** (한 줄 설명):
  - `R-1` Energy Balance — 에너지 시스템 분포 균형
  - `R-2` MAIN Interval — MAIN 간격 9.5±1.5일 유지
  - `R-3` Z1 Recovery — Z1 비율 ≥ 15%
  - `R-4` EPOC Recovery — 회복 시간 충족
  - `R-5` Weekly Volume — 주간 볼륨 목표 범위
  - `R-6` Pace Regression — 페이스 후퇴 감지
  - `R-7` HR Drift — 심박 표류 한계
  - `R-8` Injury Flag — 통증·부상 누적 신호
  - `R-9` Taper Check — 대회 직전 부하 감량 검증
  - (정확한 임계값·구현은 `design-system/SYSTEM_FOUNDATIONS.md` 정본)
- **D-day rules**: `D-1`–`D-9.5` (사이클 일자 기반)
- **Trigger rules**: `T-2` 등
- **결정 기록 코드**: `Q1`–`Q6` (시각화 결정), `Q3 결정` 등

### 5.4 Verdict 값
`RECOMMEND` `UNCERTAIN` `WARN` `LACK`

### 5.5 시스템 고유 명사
`9.5-Cycle` · `9 Rules` · `AI Inbox` · `Daily Check-in` · `MIXED` · `PB chip row` · `PB Trail` · `Personal Archive` · `Range Switcher` · `Records` (4 Records: PB / SB / Target / Reference) · `Rule engine` · `Track Record` (제외) · `Cohort` (P3) · `Knowledge base` (P3)

### 5.6 데이터 엔티티
`Athlete` · `ChatThread` · `CheckIn` · `Coach` · `Competition` · `Cycle` · `InboxItem` · `Message` · `Provider` · `Session` · `User` · `ValidationResult`

### 5.7 디자인 시스템 코드
- **Tier**: `T1 Strong` · `T2 Mid` · `T3 Subtle` · `T4 Wash`
- **Tokens**: `--bg` · `--surface` · `--ink` · `--ink-2/3/4` · `--line` · `--hair` · `--brand` · `--ok` · `--warn` · `--err` · `--unc` · `--info` · `--e-base/lt/vo2/gly/atp/rest`

### 5.8 한영 표기 빠른 결정 표

| 상황 | 결정 |
|---|---|
| 사용자가 영어로 학습한 훈련 용어 | **영어 + 모노** |
| 측정 지표·페이스·시간 | **영어 + 모노 + 단위** |
| 일반 문장·메시지·UI 라벨 | **공식 한국어** |
| 시스템 고유 명사 (PB Trail 등) | **영어**, 첫 등장 시 한국어 부제 |
| 약어 코드 (R-N, D-N) | **영어 + 모노** |
| 개발 내부 문서 | **영어** OK |
| 사용자 노출 라벨 | **한국어 우선** |

---

## 6. 변경 이력

| 일자 | 변경 | 비고 |
|---|---|---|
| 2026-04-29 | 최초 작성 | 0–7 섹션, 약 100여 용어 |
| 2026-04-29 | 한국어 카피 정비 반영 | §0.4 절대 피하는 표현 표 (1급 시민, 트리거, 단계노출, ledger, 채택율, 회수 등) |
| 2026-04-29 | §5.3 9 Rules 한 줄 설명 보강 | R-1~R-9 각 규칙의 핵심 내용 인덱스에 추가 |
| 2026-04-29 | index.html에 GLOSSARY 카드 추가 | Root docs 섹션에서 진입 가능, readiness check에도 OK 항목 추가 |

---

## 7. 관련 문서

- `PHILOSOPHY.md §6` — 한영 혼용 규칙 (원전)
- `DESIGN_DECISIONS.md` — 시각화 결정 (Q1–Q6)
- `design-system/DESIGN_TOKENS.md` — 4-tier 토큰 정의
- `design-system/VISUALIZATION_SYSTEM.md` — 차트 시스템 정본
- `design-system/SYSTEM_FOUNDATIONS.md` — 9 Rules · 9.5-Cycle 정의
- `design-system/SCREENS.md` — 화면 인벤토리 (데이터 의존성)
- `design-system/COMPONENT_INVENTORY.md` — UI 컴포넌트 정본
- `design-system/FEATURE_TIERS.md` — 우선순위
- `design-system/SAFEGUARDS.md` — 안전 가드

---

> **이 문서가 더 이상 정확하지 않으면 즉시 갱신하세요.**
> 코드·디자인·문서 어디에서든 새 용어를 도입하면 우선 여기에 정의하고, 모든 참조에서 일관되게 사용합니다.
