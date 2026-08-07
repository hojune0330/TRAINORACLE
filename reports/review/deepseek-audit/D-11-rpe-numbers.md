# D-11. RPE 숫자 전수 대장

```yaml
packet: D-11
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- 패킷: D-11 (`WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md` §PHASE 3 D-11)
- 감사자: DeepSeek (지시서 v1.1 실행자) / Round 3
- 기준 커밋: b4f5d99
- pending: 없음

## 1. 개요

**목적:** RPE는 사용자에게 직접 보이는 숫자다. 문서마다 다르면 거짓 약속. 코드 기준(`impl/src/plan-generator/session-builder.ts:73-91` `rpeForIntent()`)과 전수 대조했다. **이 숫자는 OD-SLOT-5로 불변 확정 — 문서가 다르면 문서 쪽이 틀린 것.**

## 2. 코드 기준 (session-builder.ts:73-91, 재확인)

| intent | RPE |
|---|---|
| RECOVERY_INTENT | 1-2 |
| BASE_INTENT | 3-4 |
| LT_INTENT | 5-6 |
| VO2_INTENT · GLY_INTENT | 7-8 |
| ATP_PC_INTENT | 8-9 |
| MIXED_INTENT | 6-7 |

## 3. 전수 스캔

- `grep -rnE 'RPE ?[0-9]' --include='*.md' .` → **98건** (node_modules 제외)
- 범위 패턴 빈도: `RPE1-2` 28 / `RPE1~2` 16 / `RPE3-4` 10 / `RPE7-8` 2 / `RPE8-9` 1 / `RPE6-7` 1 / `RPE5-6` 1 / **`RPE4-5` 1**
- 단일값(범위 없는 `RPE n`) → **0건**

## 4. 대조 표 (지시서 §D-11 출력 형식)

| 문서 | 행 | 문서가 쓴 RPE | 그 문맥의 intent | 코드값 | 일치? |
|---|---:|---|---|---|---|
| `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` | 174 | 3-4 | BASE_INTENT | 3-4 | 일치 |
| `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` | 175 | 5-6 | LT_INTENT | 5-6 | 일치 |
| `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` | 176 | 7-8 | VO2/GLY_INTENT | 7-8 | 일치 |
| `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` | 177 | 8-9 | ATP_PC_INTENT | 8-9 | 일치 |
| `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` | 178 | 6-7 | MIXED_INTENT | 6-7 | 일치 |
| `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` | 164 | 1-2 / 3-4 | RECOVERY/BASE (OD-SLOT-5) | 1-2 / 3-4 | 일치 |
| `specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` | 197-198 | 1-2 / 3-4 | 회복/기초 유산소 설명 | 1-2 / 3-4 | 일치 |
| `specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` | 132 | 1-2 | DSB-INV-002 (RECOVERY 전용 아님) | 1-2 | 일치 (설명 문구) |
| `specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` | 187,290 | 1-2 | RECOVERY_INTENT | 1-2 | 일치 |
| `CURRENT_IMPLEMENTATION_HANDOFF_2026-07-27.md` | 75,111 | 7-8 / 1-2 / 3-4 | QUALITY·회복 세션 | 7-8 / 1-2 / 3-4 | 일치 |
| `reports/implementation/DAILY_…IMPLEMENTATION_REPORT_2026-07-27.md` | 44,66,70,72 | 1-2 / 3-4 | 회복/기초 | 1-2 / 3-4 | 일치 |
| `reports/review/SPEC_TO_BETA_PERSONALIZATION_ALIGNMENT_AUDIT_2026-07-27.md` | 158,160 | 1-2 / 3-4 | 회복/기초 | 1-2 / 3-4 | 일치 |
| `reports/review/WORK_ORDER_SLOT_TYPE_EXTENSION_B_REPORT.md` | 44,67 | 1-2 | PM 회복 | 1-2 | 일치 |
| `WORK_ORDER_SLOT_TYPE_EXTENSION_B.md` | 180 | 1-2 | PM 회복 | 1-2 | 일치 |
| `WORK_ORDER_SLOT_INTENSITY_FULL_RUN.md` | 535~621 (다수) | 1-2 / 3-4 | 회복/기초 오너 지시 재현 | 1-2 / 3-4 | 일치 |
| `WORK_ORDER_UX2_COACH_HOME_AND_JOURNAL_HONESTY.md` | 324 | 1-2 | 회복 약속 | 1-2 | 일치 |
| `WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md` | 247 | 3-4 | 고강도 날 회복 대안 (BASE) | 3-4 | 일치 |
| `WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md` | 53 | **4-5** | (예시 문장) | 3-4 | **예시 미재현 — 아래 §5-F1** |

**해당없음 (intent 무관 문맥, 불일치로 세지 않음):** `specs/legacy-reference/GLOSSARY.md` RPE 1-10 스케일·`RPE 7.5` 예시; `specs/active/SESSION_CLASSIFIER_SPEC.md:1018-1021` TC-IC RPE 2/5/7/9 (강도 구분 임계값); `specs/active/PHYSIO_SOURCE_TRUST_SPEC.md`·`specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`·`DAILY_LOG…`의 `RPE_STRUCTURED`/`structured_RPE` (필드명/소스 타입).

## 5. 세부 발견

**F1 — 워크오더 예시의 RPE 4-5가 현재 스냅샷에서 미재현.** `WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md:53`은 "`PLAN_GENERATOR_SPEC.md:412` RPE 4-5 → 불일치"를 예시로 든다. 그러나 **현재 `specs/active/PLAN_GENERATOR_SPEC.md`에는 RPE 문자열이 0건** (`grep -n "RPE" …` 빈 결과)이고, :412 (`sed -n 405,418p`)는 `plan_safety_gate_binding` 구간이다. 예시가 가리키는 문서·행이 이 스냅샷에 존재하지 않음 — 해당 지점의 실측 불일치 **0건**으로 기록. (과거 버전에서 수정됐을 가능성 — git history 확인은 범위 외.)

**F2 — intent × RPE 맵을 실제로 쓰는 문서 중 불일치 0건.** 스캔된 모든 intent 문맥 RPE(RECOVERY 1-2, BASE 3-4, LT 5-6, VO2/GLY 7-8, ATP_PC 8-9, MIXED 6-7)가 코드와 일치. 특히 OD-SLOT-5(2026-08-06, 불변 확정)가 코드와 동일 표를 재확인.

**F3 — 워크오더 2종(UX2_C3A:324, PM_QUALITY_C3A:247, SLOT_INTENSITY_FULL_RUN)의 RPE 1-2/3-4는 OD-SLOT-1(2026-08-06, PM 회복 고정 해제) **이전** 작성으로 추정되는 문맥이지만, 그 숫자 자체는 코드와 일치.** "PM = RPE 1-2 고정"이라는 정책 문구가 OD-SLOT-1 이후에도 남아 있는 워크오더 문서는 D-17(거짓 약속) 및 소유자 결정의 supersedes 추적 대상으로 참고 이관.

**F4 — 단일값 RPE 전무.** 사용자 입력 스케일(`RPE 7.5` 등)을 제외하면 범위 없는 단일 RPE 표기는 0건 → 반올림/경계 표현 불일치 소지 없음.

## 6. OD-REQ

- OD-REQ: **0건** (실측 불일치 0건. F1의 "예시 미재현"은 사실관계로 참고만 — 워크오더가 참조한 과거 상태 판정은 범위 외)

## 7. 한계

- `WORK_ORDER_*`·`CURRENT_IMPLEMENTATION_HANDOFF_*` 계열은 스캔에 포함했으나, 이들이 현재 유효 정책인지(OD-SLOT-1 이후 갱신 여부)는 D-17에서 취급.
- 범위 패턴 정규식은 `RPE1-2`·`RPE 1-2`·`RPE1~2`·`RPE 1–2`(엔 대시) 포함 — 콤마/한글 표기(`RPE 1, 2`)는 미포함(0건으로 확인되는 별개 표기).
