# D-18 — `DSB-INV-001`~`009` 코드 강제 지점 대장

```yaml
packet: D-18
executor: DeepSeek
executed_at: "2026-08-07"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- **감사자**: DeepSeek (지시서 v1.1 실행자)
- **일자**: 2026-08-07
- **스냅샷**: main HEAD = b4f5d99 (= origin/main)
- **판정 요약**: 9개 규칙 전수 — **강제 있음 7 / 부분 강제 2(DSB-INV-002, 005) / 완전 "강제 없음" 0**. 🔴 2건(002: 코드-OD-SLOT-1 불일치, 005: 7일 프레임 상한 1 미반영). 저장 관문 미강제 1건(005)은 **의도된 것**(FULL_RUN §4.6b).
- **OD-REQ**: 2건 (OD-REQ-D18-001, OD-REQ-D18-002)

## 1. 방법

지시서 §12 D-18(L885~907)에 따라 두 코드 지점만 읽었다: (1) 저장 관문 `app/src/domain/plan-beta-schema.ts:64-124`(superRefine), (2) 생성기 `impl/src/plan-generator/session-builder.ts:150-174`(recoverySecondSessionDays) + 생성 흐름(만들어지지 않는 경로 확인). 강제 방식은 4분류(저장관문 거부 / 생성기가 애초에 안 만듦 / UI 문구만 / 강제 없음). 규칙 원문은 `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md:125-150`에서 1줄 인용.

## 2. 강제 지점 대장

| 규칙 | 규칙 요지(스펙 1줄 인용) | 코드 강제 지점 | 강제 방식 | 검증기 | 판정 |
|---|---|---|---|---|---|
| DSB-INV-001 | "second session on a beta day is absent unless `RECOVERY_PM_ALLOWED` was selected" | 생성기 `session-builder.ts:153-157`(RECOVERY_PM_ALLOWED 아니면 `[]`) + 저장 관문 `plan-beta-schema.ts:85-88`("PM consent is missing.") | 생성기가 안 만듦 + 저장관문 거부 (이중) | 없음(C-9) | 강제 있음 ✅ |
| DSB-INV-002 | "second session may be `REST`, `EASY`, or `QUALITY`. It is **not** restricted to `RECOVERY_INTENT` or `RPE 1-2`" (OD-SLOT-1·2·7) | 생성기: PM = `easyTrainingSession(..., "PM", recoverySupport, "RECOVERY_INTENT")`(session-builder.ts:209-216, QUALITY PM 생성 경로 없음) + 저장 관문 `:78-84`(PM은 EASY+RECOVERY_INTENT+RPE1-2 필수, 아니면 "Invalid PM recovery support.") · `:108-112`("PM recovery cannot follow quality.") | 생성기가 안 만듦 + 저장관문 거부 — **그러나 스펙 신규 정의(QUALITY PM 허용)와 코드가 반대** | 없음(C-9) | 🔴 부분 강제: 강제는 존재하나 **코드-스펙 불일치** (㉢-b에서 개편 예정 — D-17 OD-REQ-D17-001과 동일 근원) |
| DSB-INV-003 | "Default: at most one `QUALITY` session per beta day…never produce two same-day `QUALITY` on its own" | 생성기 `balancedQualityDays`(candidates.ts:127-155, 프레임당 최대 2 quality day·하루 1개만) + 저장 관문 `:108-112`(PM+QUALITY 동시일 거부) | 생성기가 안 만듦 + 저장관문 거부 (이중) | 없음(C-9) | 강제 있음 ✅ |
| DSB-INV-004 | "at most two sessions per day. Each `(day, slot)` pair is unique" | 저장 관문 `:74-77`("Duplicate plan session slot.")·`:105-108`("Too many sessions in one day.") | 저장관문 거부 | 없음(C-9) | 강제 있음 ✅ |
| DSB-INV-005 | "at most **one** PM `RECOVERY_INTENT` in a 7-day frame, at most **two** in 9/9.5/10-day frame…Conservative shows none" | 생성기 `recoverySecondSessionDays` `limit = 2`(session-builder.ts:165) — **그러나 프레임 길이와 무관**, 7일 프레임에서도 2개 허용 / Conservative·RECOVERY_INTENT 계획은 `[]`(:153-157로 0개) | 생성기 부분 강제(개수≤2, Conservative 0) + **저장 관문 미강제는 의도됨** | 없음(C-9) | 🔴 부분 강제: **7일 프레임 상한 1 미반영** (현재 베타는 9.5일 고정이라 미발현 — S-2에서 7일 프레임 도입 시 위반) |
| DSB-INV-006 | "available day includes recovery movement. `EVERY_DAY` does not create extra quality days" | 생성기 `balancedQualityDays`가 availableDays 길이·선택 intent로만 quality 산출(EVERY_DAY 특별 취급 없음) + `spreadTrainingDays`(plan-beta-flow.ts:232-245)는 [1..10] 펼침만 | 생성기가 애초에 안 만듦 | 없음(C-9) | 강제 있음 ✅ |
| DSB-INV-007 | "A skipped or incomplete AM/PM session is not moved, duplicated, or added to a later day" | 생성기: recoverySecondSessionDays는 메이크업 로직 없음(선택된 요일 배열만), 보충/메이크업 경로 코드 grep 0건(`labels.ts:184` REST 문구만) | 생성기가 애초에 안 만듦 (아무 일도 안 함으로 강제) | 없음(C-9) | 강제 있음 ✅ |
| DSB-INV-008 | "Any beta session…may show only duration range, RPE range, intent, and plain-language guidance" | 스키마 `plan-session-schema.ts:82-91,99-124`: 세션 처방이 `RPE_TIME_RANGE`(rpe+durationMinutes) 단일 종류 — 페이스/반복/거리 필드가 저장 구조에 **없음** | 저장 구조상 불가(필드 배제) | 없음(C-9) | 강제 있음 ✅ |
| DSB-INV-009 | "permitted only if both hold: (a) screen states plainly…(b) athlete has flow to review and modify or remove…If either is missing, the generator and the storage gate must not allow the day" | 생성기: 2 QUALITY 동일일 생성 불가 + 저장 관문 `:108-112` 거부 → "허용하지 않음" 충족. 편집 화면(B-17) 없음은 **스펙이 명시한 대기 상태**("must remain unreachable until B-17 ships") | 생성기가 안 만듦 + 저장관문 거부 | 없음(C-9) | 강제 있음 ✅ (규칙 요구와 일치) |

## 3. 핵심 발견

1. **🔴 DSB-INV-002 — 코드가 스펙의 신규 정의(OD-SLOT-1·2·7)와 반대로 동작한다**: 규칙 자체는 BM 2026-08-06에 "QUALITY PM 허용"으로 개정됐는데, 생성기는 QUALITY PM을 만들 수 없고 저장 관문은 PM=RPE 1-2 회복만 통과시킨다. 단, 이는 **의도된 단계적 전환**(계약 테스트 :95-110 "OD-SLOT-1/7 supersede this for generation, but the storage gate is reworked only in ㉢-b — until then C-4 is current")이며, D-17의 문구 긴장과 같은 근원이다. 강제 자체는 있어서 **"강제 없음"이 아니지만, 스펙 최신 정의 기준으로는 코드가 낡았다**.
2. **🔴 DSB-INV-005 — 7일 프레임 상한 1이 코드에 없다**: `limit = 2`가 프레임 길이와 무관하게 적용된다. 현재 베타는 9.5일 프레임 고정(`LOCAL_CIVIL_9_5`)이라 미발현이지만, S-2에서 7일 프레임을 만들면 규칙 위반이 발생한다. 저장 관문 미강제는 지시서 주의대로 **의도된 미강제로 기록**(FULL_RUN §4.6b — 넣으면 사용자가 고칠 수 없는 `PLAN_STORAGE_WRITE_FAILED` 발생).
3. **"강제 없음이면서 스펙이 '반드시'라 쓴 규칙": 0건** — DSB-INV 9개 모두 생성기·저장 관문·스키마 중 하나 이상의 실질 강제를 가진다. 완전 방치 규칙은 이 9개에는 없다.
4. **모두 기계 검증 0건** — D-09 결론(FRV2-CONF 유일 🟡, DSB 계열 검증기 부재)과 정합. 다만 계약 테스트(`plan-beta-schema.contract.test.ts` 저장 관문, `plan-beta-flow.contract.test.ts`)가 수동 CI 실행으로 강제 동작을 잠그고 있다 — "기계 검증" 정의상 CI 스크립트 등록 기반이라 여전히 0으로 표기.

## 4. OD-REQ (결정 요청)

### OD-REQ-D18-001 — DSB-INV-002의 "QUALITY PM 허용" 전환 순서 vs 안전 문구
- **사실**: OD-SLOT-1·2·7(2026-08-06)이 QUALITY PM을 승인했으나 코드(생성기+저장 관문)는 PM=RPE 1-2 회복만 허용한다. 이 상태 유지가 스펙-코드 불일치를 남기고, 즉시 전환하면 D-17의 사용자 문구 안전 강조(PM 회복 전용)와 충돌한다.
- **왜 내가 결정하지 않는가**: 전환 시점은 ㉢-b(저장 관문 개편)의 진행 순서와 B-17(편집 화면) 의존성(DSB-INV-009)에 묶여 있고, 실행 책임은 선행 감사자·진행자가 갖는다.
- **선택지 A**: ㉢-b에서 저장 관문 완화 + 문구 수정을 세트로 진행(현재 D-17의 🔴 문구도 함께 해소).
- **선택지 B**: OD-SLOT-1의 생성만 우선 반영(생성기는 QUALITY PM 허용)하고 저장 관문·문구는 유지 — 단 사용자는 "오후 RPE 1-2"가 아닌 계획을 볼 수 있어 D-17 🔴 문구의 거짓이 현실화.
- **어느 문서를 함께 봐야 하나**: `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md`(OD-SLOT-1·2·7), `plan-beta-schema.ts:64-124`(저장 관문), `plan-beta-schema.contract.test.ts:95-110`(C-4 유효 주석), D-17(문구 긴장), D-19(B-17/㉢-b OI 상태).

### OD-REQ-D18-002 — DSB-INV-005의 7일 프레임 상한 1을 코드에 반영할 때
- **사실**: `recoverySecondSessionDays`(session-builder.ts:165)의 `limit = 2`가 프레임 길이와 무관하다. 7일 프레임에서는 상한 1이어야 한다(스펙 DSB-INV-005). 현재 9.5일 고정이라 미발현.
- **왜 내가 결정하지 않는가**: 프레임 길이 정보가 생성 흐름 어디에 전달되는지(현재 `LOCAL_CIVIL_9_5` 고정)는 캘린더 매핑 OI(D-16, `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001`)와 얽혀 있어 프레임 다변화 시점을 오너가 정해야 한다.
- **선택지 A**: 프레임 길이 파라미터를 생성기에 주입하고 `limit = frame === 7 ? 1 : 2`로 분기.
- **선택지 B**: 7일 프레임 도입 전까지 현재 limit=2를 유지하고, 7일 도입 시 함께 수정(현재 미발현이므로 변경 없음).
- **어느 문서를 함께 봐야 하나**: `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md:135`(DSB-INV-005)·`:238`(OI-DSB-FRAME-LOAD-CAP-001), `session-builder.ts:150-174`, `PLAN_GENERATOR_SPEC.md:976`(캘린더 매핑 OI), D-14(상한 대장).

## 5. 인용·판정 누수 점검

- DSB-INV-005 저장 관문 미강제는 지시서 주의대로 "결함"으로 보고하지 않고 **의도된 미강제 — 근거: FULL_RUN §4.6b**로 기록했다.
- 두 코드 지점(지시서 지정)만 읽고, 생성 경로는 makeCandidateSessions·balancedQualityDays로 검증 — "생성기가 안 만듦" 판정의 근거를 남겼다.
- "강제 없음" 규칙 0건을 명시하고, 부분 강제 2건은 강제 자체가 없는 것과 구분했다.
