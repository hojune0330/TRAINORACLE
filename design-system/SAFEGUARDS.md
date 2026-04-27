# SAFEGUARDS — 가드레일 7

> Sprint 1 종료 시 추가된 문서. **다음 화면 디자인 전 반드시 읽기.**
>
> "민지의 하루"는 골디락스 케이스다. 실제 사용자는 다양하고 데이터는 누락되고
> AI는 틀린다. 이 문서는 그 모든 경우에 화면이 어떻게 작동해야 하는지 정한다.

---

## 컨텍스트 — 이 단계의 제품 결정

이 문서가 작성된 시점의 결정 (반영 필수):

- **종목**: 중장거리 (1500m / 5000m / 10000m) 우선. 800m, 400m, 마라톤은 추후.
- **AI**: 하드코딩 + 결정 함수 (rule engine)만. LLM API 호출 없음 → 비용 0, 일관성 100%.
- **Personal Archive**: 모든 기록 시간순 그대로. 부상·후퇴·DNF 가리지 않음.
- **디바이스 데이터**: 1개 Primary 강제. 3년치 자동 import + 분석.
- **Records**: PB / SB / Target / Reference 4 타입.
- **Cold Start**: 디바이스 import 시 즉시 3년 데이터 → cold start 거의 없음.

---

## 가드레일 1 · Cold Start State

### 문제
- 신규 사용자는 데이터가 없다 (전통적 cold start)
- **하지만** 디바이스 import 시 3년 데이터 즉시 확보 → cold start 자동 해결

### 정의 — 사용자 entry path 별

**Path A · 디바이스 연동 (default, 권장)**
```
가입 → Primary device 선택 → 3년 데이터 import (5-10분 소요) → 즉시 normal
```
- Cold start 없음
- "당신의 패턴 발견" 첫 인사이트로 시작
- 모든 14d 통계, drift 분석 즉시 작동

**Path B · 디바이스 없이 수동 입력**
```
가입 → "디바이스 없음" 명시 → 14일 측정 기간 → normal
```
- 전통 cold start 적용
- 14일 미만 = `warming` 상태
- 매일 직접 입력 (RPE, sleep, distance, pace)
- AI 추천 신뢰도 -20%

**Path C · 디바이스 연동 + 수동 보완**
```
가입 → 디바이스 연동 → 일부 데이터만 (1년치 등) → 보완 위해 수동 입력 가능
```
- Path A 기준, 부족한 부분만 manual

### Stage 정의

| Stage | 조건 | 사용 가능 |
|---|---|---|
| **`bootstrap`** | 가입 직후, import 진행 중 | 진행 화면만 |
| **`fresh-import`** | 3년 데이터 import 완료 직후 | 모든 기능, 단 "첫 분석" 라벨 |
| **`cold`** (Path B) | 디바이스 없음, Day 0 | PB 기반 추정값만 |
| **`warming`** (Path B) | Day 1-14 | 일부 통계, 신뢰도 -20% |
| **`normal`** | 모든 조건 충족 | 모든 기능 |

### UI 규칙

**모든 통계 컴포넌트는 `dataState` prop 받음:**
```ts
type DataState = 'bootstrap' | 'fresh-import' | 'cold' | 'warming' | 'normal';
```

**`bootstrap` 상태:**
- Onboarding의 "분석 진행" 화면만 표시
- 다른 메뉴 접근 X

**`cold` 상태 (디바이스 없음, Day 0):**
- 숫자 자리 `—` 또는 "데이터 수집 중"
- 메시지: "PB <span class="k">5000m 16:10</span> 기준 추정값입니다. 14일 측정 후 정확해집니다."

**`warming` (Day 1-14, 디바이스 없음):**
- 숫자 표시하되 신뢰도 자동 -20%
- "초기 데이터" 모노 small 라벨
- 차트는 점선 처리

**`fresh-import` (3년 데이터 갓 들어옴):**
- 정상 표시
- 단 첫 화면에 "3년 / N개 활동 분석 완료" 자랑
- "첫 인사이트" 모듈 강조

---

## 가드레일 2 · Confidence Floor

### 문제
- AI 추천이 틀리면 사용자 부상 가능
- 신호 충돌 시 단정적 답변은 위험
- 메모리 hallucination (없는 사실 인용)

### 규칙

**Hardcoded rule engine 단계 (현재):**
- 모든 추천은 결정 함수 → confidence 계산 가능
- 입력 데이터 부족 → confidence 자동 -20%
- 신호 충돌 → "판정 불확실" verdict + 양쪽 의견

**LLM 단계 (추후):**
- Server-side 인용 검증
- 페르소나 일관성 테스트
- Hallucination 방어 (실제 facts 매칭)

### Confidence 단계별 동작

| Confidence | Verdict | 사용자 표시 |
|---|---|---|
| ≥ 90% | CONFIRM | "확정. <설명>" |
| 70-89% | RECOMMEND | "권장. <근거>" |
| 50-69% | UNC (판정 불확실) | "신호 충돌. 코치 본인 판단 필요." + alternative view |
| < 50% | LACK (데이터 부족) | "데이터 부족. 추천 보류. 추가 입력 후 재분석." |

**< 50% 시 UI:**
- 단정적 추천 표시 X
- 대신 "필요한 데이터" 명시: "RPE 14일 추가 입력 필요"
- 사용자가 결정권 명시

---

## 가드레일 3 · Mode 전환 규칙

### 문제
- 통증 한 번 입력 → 자동 CAUTION? 사용자 짜증
- 사용자가 모드 싫어서 데이터 입력 회피 ← **가장 위험**

### 규칙 — 명시적 조건

**NORMAL → CAUTION (OR 조건):**
- 통증 ≥ 4/5 입력 (한 번이라도)
- 통증 같은 부위 ≥ 3일 연속 (강도 무관)
- CK 14d > +25% AND RPE 14d > +1.0
- HR drift > 5% in last MAIN session
- 사용자 수동 전환

**CAUTION → NORMAL (AND 조건):**
- 통증 < 2/5 7일 연속 AND
- CK 14d 정상 범위 복귀
- 또는 사용자 수동 dismiss

**CAUTION → RECOVERY (사용자 액션 필수):**
- 부상 진단 입력 (사용자 명시)
- 또는 통증 ≥ 4/5 14일 연속 → 시스템이 RECOVERY 제안
- 자동 전환 X (사용자 동의 필요)

**RACE WEEK 전환:**
- 자동: 등록된 A-Race D-7
- 수동: 언제든 (B-Race도 RACE WEEK 지정 가능)
- 자동 전환 시 1회 알림 + 사용자가 거부 가능

**OFF-SEASON:**
- 사용자 명시 진입 (자동 X)
- 마지막 대회 + 28일 경과 시 시스템이 제안만

### 데이터 입력 회피 방지 (핵심)

**원칙: 통증 입력해도 즉각 페널티 X.**

- 통증 1-3 입력 → NORMAL 유지, 다음날 follow-up 1회만
- 통증 4-5 입력 → CAUTION + 부드러운 메시지: "이상 신호. 함께 봐요."
- "운동 중단" 같은 단정 X — 권장만
- 모드 변경 시 1회 알림 + "동의 / 다음에 / 거부" 옵션
- 거부 시 NORMAL 유지 (사용자 우선)

### Mode chip UI

- 화면 우상단 (greeter 옆) 항상 표시, 작게
- 클릭 시 expand:
  - "왜 이 모드인가" 설명
  - 진입 조건 충족 표시
  - 수동 변경 옵션

---

## 가드레일 4 · Narrative 안전장치

### 문제
- "내 이야기"가 잘 작동할 때만 좋음
- 부상·슬럼프·후퇴 표시 시 사용자가 떠남

### 사용자 결정 (반영 필수)
> "계속 추적하는 걸로." (모든 기록 그대로 시간순)

### 규칙

**Personal Archive 표시:**

| 항목 | 기본 | 사용자 제어 |
|---|---|---|
| 완료한 세션 | 시간순 표시 | hide X |
| PB 갱신 | 표시 | — |
| PB 후퇴 | 표시 (사실) | — |
| 부상 이력 | 사용자 입력 시 표시 | hide X |
| DNF / DNS | 표시 | hide X |
| 1년 전 같은 날 | 표시 | toggle off 가능 (개인 설정) |

**감정 평가 금지 (절대):**
- ❌ "이번 주 정말 좋았어요!"
- ❌ "지난 분기 대비 향상이 인상적이에요"
- ✅ "이번 주 weekly TSS 412, 지난 분기 평균 380"
- ✅ "1년 전 16:42, 지금 16:10. -32"."
- ✅ AI는 사실 진술만. 평가는 사용자 몫.

**비교 정직성:**
- 1년 전이 더 빨랐어도 그대로 표시
- AI는 그 사실에 대해 코멘트 X (단, 사용자가 질문 시 답함)
- "왜 후퇴했는지 분석해줘" → AI가 데이터 기반 답
- 일방적 위로 X

**예외 — 1년 전 toggle:**
- 사용자가 Settings에서 "회상 모듈 끄기" 가능
- "특정 시기 가리기" 옵션 (부상 시기 등)
- 단, default = ON

### 위기 상황 narrative

**부상 진단 시 (RECOVERY mode):**
- Archive는 그대로 — 단, 메인 화면 narrative 톤 변경
- "오늘 한 작은 진전" 강조 (1km 걷기도)
- 미래 약속 X ("회복 후 어떻게") — 현재 안정에만 집중
- 부상 부위 통증 추세는 표시 (의료 판단 보조 데이터)

**슬럼프 감지 (자동 X):**
- 사용자가 인지 시 명시 가능 ("힘들어요" 입력 등)
- 시스템이 자동 판단 X (부정확)
- 단 RPE 14d > +1.5, sleep < 6h 14d 평균 등은 알림

---

## 가드레일 5 · AI 일관성 유지

### 문제
- 모델 업데이트 시 톤 변화 → "다른 사람이 됨"
- 페르소나 깨지면 신뢰 붕괴

### 현 단계 (하드코딩) — 위험 낮음
- LLM 미사용 → 일관성 자동 보장
- 모든 응답은 결정 함수 → 같은 입력 = 같은 출력
- 페르소나 = 정의된 텍스트 템플릿

### 추후 LLM 단계 시 규칙

**페르소나는 stable:**
- 시스템 프롬프트 v1.0 → v2.0 변경 시 사용자에게 명시
- 페르소나 핵심 (이름, 톤, 호명 패턴)은 절대 안 바뀜

**모델 업데이트 시 UI:**
```
v0.3.1 → v0.3.2 업데이트
새 연구 반영: Daniels et al. 2026 (4월)
이전과 추천이 달라지는 영역: 인터벌 휴식 시간 (-15s)
[자세히] [동의 후 적용]
```

**Stable channel option (Settings):**
- "최신 모델 사용" (default)
- "안정 채널 사용" — 분기마다 검증 후 업데이트

---

## 가드레일 6 · Track Record 표시

### 문제
- 신규 사용자엔 의미 없음
- 0% / 100% 양 극단 의심
- 사용자 압박 가능

### 현 단계 — 표시 X

**하드코딩 단계에선 동의율 통계가 의미 없다:**
- AI 추천 = 결정 함수 → 항상 같은 답
- 사용자 동의/거부 = 실제 행동 데이터 부족 (베타 단계)
- 표시 X

### 추후 LLM 단계 시 규칙

**Track Record 표시 조건:**
- AI 추천 누적 ≥ 30회 이상
- 90일 이내 데이터만
- 동의율 30%-95% 사이일 때만 (양 극단 X)
- "참고용" 모노 small 라벨

**기본 안 보임. 사용자가 expand 시 보임.**

**대신 보여줄 것:**
- "이 추천은 A_guide §4에 근거"
- "지난 사이클에서 ✓ 동의했고, 결과 ±2" 일치"
- 즉 fact만, 평가 X

---

## 가드레일 7 · Citation 검증

### 문제
- AI hallucination (없는 인용 만들기)
- 인용해도 도움 안 되는 원문
- 인용 너무 많으면 사용자 안 봄

### 현 단계 — 위험 낮음
- 하드코딩 단계 = 인용도 결정적 (미리 정의된 source DB)
- Hallucination 발생 X
- 단 인용 자체의 디자인 규칙은 적용

### 인용 디자인 규칙

**Tier 별 표시:**

| Tier | 종류 | Mark | 설명 |
|---|---|---|---|
| J | Coach Jang's Note (A_guide) | `[J1]` | 가장 권위 |
| P | Peer-reviewed paper (Daniels 등) | `[P1]` | 외부 문헌 |
| Y | Your own data | `[Y1]` | 본인 데이터 |
| C | Cohort data (anonymous, opt-in) | `[C1]` | 비교 (참고용) |

**인용 5개 초과 시:**
- 처음 4개 + "이 외 N개" 접기
- 클릭 시 expand

**인용 클릭 시:**
- 짧은 발췌 (1-2 문장)
- 출처 메타 (저자, 연도, 섹션)
- "전체 보기" 링크

**좋은 예 ✅:**
> [J1] **A_guide §4.2 — 회복 신호 충돌 시 판단** (Coach Jang, 2023)
> > "객관 마커(CK, HR drift)와 주관 신호(RPE, sleep)가 충돌할 때, 주관 신호를 우선한다."
> [전체 문서 보기 →]

**면책 (작게, LLM 단계 도입 시):**
> "AI 응답에 인용된 출처가 부정확할 수 있습니다. [신고하기]"

### 추후 LLM 단계 시 — Server-side 검증

```typescript
async function validateCitation(citation: Citation): Promise<boolean> {
  switch (citation.tier) {
    case 'J': return await coachNoteDB.exists(citation.section);
    case 'P': return await paperDB.lookup(citation.title, citation.author, citation.year);
    case 'Y': return await userDB.verifyDataPoint(userId, citation.dataRef);
    case 'C': return await cohortDB.hasAggregate(citation.query);
  }
}

// AI 응답 후처리:
const validated = await Promise.all(citations.map(validateCitation));
const safeResponse = removeFailedCitations(response, validated);
if (validatedCount < originalCount) {
  safeResponse.confidence -= (originalCount - validatedCount) * 5;
}
```

---

## 검증 매트릭스 — 모든 새 화면이 통과해야 할 체크

| # | 체크 | 통과 기준 |
|---|---|---|
| 1 | Cold start 처리 | `dataState='bootstrap'/'cold'/'warming'/'fresh-import'/'normal'` 모두 정의 |
| 2 | Confidence floor | AI 발언에 confidence 명시, < 50% 시 동작 정의 |
| 3 | Mode 전환 | 자동 전환 조건 OR 사용자 dismiss 가능 |
| 4 | Narrative 안전 | 감정 평가 0개, 사실 진술만 |
| 5 | AI 일관성 | (현 단계) 하드코딩이라 자동 통과 |
| 6 | Track record | (현 단계) 표시 X |
| 7 | Citation 표시 | Tier 4종, 5개 초과 시 접기, 발췌 표시 |

**7개 다 통과해야 production 배포.**

---

## 미구현 / 추후 결정

- [ ] Cohort data (C tier 인용) — privacy 검토 필요. anonymize 방식, opt-in flow
- [ ] LLM 도입 시 stable / latest channel 선택 UI
- [ ] 종목 확장 (400m / 800m / 마라톤) — 사이클 길이 자동 조정
- [ ] Coach view (8명 동시 보기) — 종합 alert system
- [ ] Multi-language 페르소나 톤 일관성 (한국어 vs 영어)

---

## 디바이스 연동 정책

### 결정사항 — Primary Device 1개 강제

**원칙:**
- 분석/추천의 base = Primary device 1개
- Secondary는 **읽기만 표시** (옵션)
- 페이스/HR/거리 통계 = Primary 기준만

**Primary device 변경 시:**
- 명시적 migration 화면
- "Garmin → COROS로 변경합니다. 과거 3년 Garmin 데이터는 history로 유지됩니다."
- 변경 후 30일 = 신규 source 학습 기간 (신뢰도 -10%)

**Secondary 가능한 데이터:**
- Apple Health: 일상 걸음, 수면, 심박 (training 외 컨텍스트)
- Samsung Health: 동일
- Strava: 활동 메타 (route, segment)

**Secondary는 표시만, 분석에 안 씀.**

### 디바이스 연동 우선 순위

1. **Garmin Connect** — 가장 정확한 running 데이터
2. **COROS** — 두번째
3. **Polar** — 세번째
4. **Apple Health / Samsung Health** — Primary 가능하나 페이스 정확도 낮음 (시계 없을 때)
5. **Strava** — Primary 불가, secondary만 (자체 측정 X)

---

## 한 줄 결론

> **"디자인은 골디락스 케이스 + 7개 실패 케이스를 모두 통과해야 끝난다."**

Sprint 2부터 모든 새 컴포넌트는 이 매트릭스를 통과해야 한다.
