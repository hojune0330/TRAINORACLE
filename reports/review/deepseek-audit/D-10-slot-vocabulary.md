# D-10. 슬롯·시간 어휘 전수 대조

```yaml
packet: D-10
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- 패킷: D-10 (`WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md` §PHASE 3 D-10)
- 감사자: DeepSeek (지시서 v1.1 실행자) / Round 3
- 기준 커밋: b4f5d99 (main HEAD = origin/main)
- pending: 없음

## 1. 개요

**목적:** 같은 개념(하루 중 훈련 슬롯)을 문서마다 다른 이름·값 집합으로 부르는지 전수 대조. C-11에서 알려진 4값(스펙) vs 2값(앱) 외에 **제3의 값 집합**을 쓰는 문서가 있는지가 본 과제.

**방법 (지시서 명령 그대로):**
1. `grep -rnE '"(AM|PM|DOUBLE|FLEX|FULL_DAY|UNSPECIFIED|MORNING|EVENING|ANY)"' --include='*.md' specs/` → 11건
2. `grep -rnoE 'SessionSlot|sessionSlot|slot *[:=]' --include='*.md' specs/` → 17건
3. 코드 실측: `grep -rn 'sessionSlotSchema|SessionSlot' app/src impl/src` + `plan-session-schema.ts` 정독

## 2. 결론 (한 줄)

C-11 기지의 `4값(AM|PM|DOUBLE|FLEX) vs 2값(AM|PM)` 외에, **`MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`가 서로 다른 4값 집합 2종**(`CalendarSessionSlot`·`halfDayPhase`)을 추가로 운용 중이다 — **제3·제4 값 집합 존재** (신규 발견).

## 3. 대조 표 (지시서 §D-10 출력 형식)

| 문서 | 행 | 선언한 슬롯 값 집합 | 코드(`plan-session-schema.ts:12` = `AM\|PM`)와 일치? |
|---|---:|---|---|
| `specs/active/PLAN_GENERATOR_SPEC.md` | 753~756 | `SessionSlot = "AM" \| "PM" \| "DOUBLE" \| "FLEX"` (4값) | 불일치 (C-11 기지 · 재확인) |
| `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | 411 | `CalendarSessionSlot = "AM" \| "PM" \| "FULL_DAY" \| "UNSPECIFIED"` (4값) | **불일치 — 제3 값 집합 (신규)** |
| `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | 431 | `halfDayPhase: "AM" \| "PM" \| "FULL_DAY" \| "UNKNOWN"` (4값) | **불일치 — 제4 값 집합 (신규)** |
| `specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` | 101~109 | `session_slot: AM/PM` + `sessionDay+sessionSlot` 예 `"1:AM"`, `"1:PM"` (2값) | 일치 — AM/PM은 주·서수의 반일(班日) 개념, 시계 시간 아님 |
| `specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` | 253~255 | (언급 구문) 두 상위 스펙의 4값 집합 인용 | 불일치 문구를** 스스로 인지** (upstream 방향 확인) |
| `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` | 50~51 | 오전 슬롯(AM)=새벽+오전, 오후 슬롯(PM)=오후+저녁 (2값) | 일치 — 최신 오너 결정도 2값 어휘 사용 |
| `app/src/domain/plan-session-schema.ts` | 12 | `z.enum(["AM","PM"])` (2값) | — (기준) |
| `impl/src/plan-generator/session-types.ts` | 7 | `PLAN_SESSION_SLOTS = ["AM","PM"] as const` (2값) | 일치 — 코드 전역 2값 일관 |

## 4. 세부 발견

**F1 — 제3 값 집합: `CalendarSessionSlot` (MICROCYCLE:411).** `"AM" | "PM" | "FULL_DAY" | "UNSPECIFIED"`. DOUBLE의 4값(`DOUBLE/FLEX`)도, 앱 2값도 아닌 고유 집합. 같은 파일 `CalendarSessionProjection.sessionSlot`(`:444`)과 `CycleDayAssignment`(`:215~219`)이 이 타입 사용.

**F2 — 제4 값 집합: `halfDayPhase` (MICROCYCLE:431).** `"AM" | "PM" | "FULL_DAY" | "UNKNOWN"`. `UNSPECIFIED` 대신 `UNKNOWN`을 쓰는 또 다른 4값. 같은 스펙 내에서도 객체별로 어휘가 분화(CalendarSessionSlot=UNSPECIFIED vs halfDayPhase=UNKNOWN).

**F3 — DOUBLE_SESSION_BETA_SAFETY_CONTRACT는 2값으로 스코프 제한.** `session_slot` 정의(:100~102)는 AM/PM 2개뿐이며 "AM/PM are ordinal halves of a local beta day, not civil clock times"(:115~116)라고 개념까지 고정. local_progress_identity 예(:109)도 `1:AM`,`1:PM`. **최신 오너 결정(2026-08-06)과 코드가 2값인 반면, 이 계약이 의존하는 상위 스펙 2건이 각각 별도 4값을 가진 구조**임.

**F4 — 최신 오너 결정(2026-08-06)이 2값.** `오전 슬롯(AM)=새벽+오전 / 오후 슬롯(PM)=오후+저녁`(:50~51) — OD-SLOT-1~3의 슬롯 거래는 전부 AM/PM 2값 위에서 성립. 즉 **소유자 위치에서 본 슬롯은 2값**이며, 4값(`DOUBLE/FLEX/FULL_DAY`)은 소유자 결정 문서에 등장하지 않음.

**F5 — 오탐 제외 3건.**
- `specs/active/APP_IMPLEMENTATION_BRIDGE.md:894` / `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md:299` — `side?: "LEFT"|"RIGHT"|"BILATERAL"|"UNSPECIFIED"`는 **신체 부위** enum (슬롯과 무관).
- `specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:190,485` — `slot:`은 **장식 pagePlacements 슬롯**(HEADER_TAPE/TOP_CORNER/…)으로 훈련 세션 슬롯과 무관 (D-07 주입 대상 문서로 확인).
- `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md:253~255`는 4값 문구를 직접 선언한 게 아니라 상위 스펙을 인용한 것.

## 5. OD-REQ

- OD-REQ: **0건** (D-10은 어휘 전수 대조 사실 실측. "슬롯 값 집합을 어느 것으로 통일할지"는 소유자·구현 프로세스의 결정 사항 — D-22 종합 패킷에서 결정 블록으로 이관 참조. 단, 제3·제4 집합의 **존재 사실**은 D-22에 전달됨)

## 6. 한계

- 스캔의 Tier-1 명령은 `specs/`만 대상. `.omo/` 도면·계획서·`reports/` 구현 보고서의 슬롯 어휘는 별도 스캔 대상이 아님(범위 외).
- `FULL_DAY`·`UNKNOWN` 등 값의 **의미 정의**(캘린더 표기 vs 일정 배치)는 MICROCYCLE 스펙 내부 문서로 D-12(밴드)와 연계해 더 읽을 수 있으나, 본 패킷은 "어떤 값 집합이 존재하는가"까지가 스코프.
- 이유 없는 "어느 쪽이 옳다" 판정 금지(verdict_authority: NONE) 원칙에 따라 표기·판정 없이 사실·정합 여부만 기록.
