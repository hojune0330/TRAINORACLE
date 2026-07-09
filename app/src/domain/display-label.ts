// =============================================================================
// TRAINORACLE — Display Label Namespace Discipline
//
// 근거:
//  - SPEC_SCREEN_TRACEABILITY_MATRIX.md CONFLICT C1~C5
//  - MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md (ACCEPTED_AS_WORKING_SOURCE, Round 3)
//    → CYCLE_DAY / RULE_SPEC_D1_D9 / LEGACY_PHASE_D 3-네임스페이스 분리
//
// 원칙:
//  1. UI에 노출되는 모든 "D-*" 류 짧은 라벨은 반드시 typed backing object가 뒷받침한다.
//  2. bare string "D-5"를 컴포넌트 props/데이터에 직접 넣는 것을 타입 수준에서 금지한다.
//  3. 짧은 표시 라벨 렌더링은 최종 UI 계층(formatCycleDayLabel 등)에서만 수행한다.
//  4. RULE_SPEC_D1_D9 네임스페이스 라벨은 안전 규칙 ID이며, CYCLE_DAY 표시와
//     절대 혼용될 수 없다 (isRuleId 플래그로 구분 강제).
// =============================================================================

/** 훈련 사이클 일자 표기 네임스페이스 (9.5일 사이클) */
export interface CycleDayLabel {
  readonly namespace: "CYCLE_DAY"
  /** 예: "D-5", "D-0.5" — 사이클 내 위치. 규칙 ID가 아님. */
  readonly value: string
  readonly isRuleId: false
  /** 사이클 번호 (예: 7 → "C7") */
  readonly cycleNumber?: number
  /** 사이클 총 길이 표기 (기본 9.5) */
  readonly cycleLength?: number
}

/** 9 Rules(D1~D9) 규칙 ID 네임스페이스 — 안전 판정 표면에서만 사용 */
export interface RuleIdLabel {
  readonly namespace: "RULE_SPEC_D1_D9"
  /** 예: "D-9" — 규칙 식별자. 날짜/사이클 위치가 아님. */
  readonly value: string
  readonly isRuleId: true
}

/** 레거시 위상 표기 — 신규 UI 도입 금지, 이관 데이터 판독 전용 */
export interface LegacyPhaseLabel {
  readonly namespace: "LEGACY_PHASE_D"
  readonly value: string
  readonly isRuleId: false
}

export type DisplayLabel = CycleDayLabel | RuleIdLabel | LegacyPhaseLabel

// ---- Constructors (유일한 생성 경로 — bare string 유통 차단) ----

export function cycleDay(
  value: string,
  opts?: { cycleNumber?: number; cycleLength?: number },
): CycleDayLabel {
  return {
    namespace: "CYCLE_DAY",
    value,
    isRuleId: false,
    ...(opts?.cycleNumber !== undefined ? { cycleNumber: opts.cycleNumber } : {}),
    ...(opts?.cycleLength !== undefined ? { cycleLength: opts.cycleLength } : {}),
  }
}

export function ruleId(value: string): RuleIdLabel {
  return { namespace: "RULE_SPEC_D1_D9", value, isRuleId: true }
}

// ---- Final-layer formatters (표시 문자열은 여기서만 생성) ----

/** 예: cycleDay("D-6", {cycleNumber:7, cycleLength:9.5}) → "C7 · D-6/9.5" */
export function formatCycleDayLabel(label: CycleDayLabel): string {
  const cycle = label.cycleNumber !== undefined ? `C${label.cycleNumber} · ` : ""
  const len = label.cycleLength !== undefined ? `/${label.cycleLength}` : ""
  return `${cycle}${label.value}${len}`
}

/** 규칙 ID는 항상 네임스페이스가 드러나는 형태로만 표시 (예: "RULE D-9") */
export function formatRuleIdLabel(label: RuleIdLabel): string {
  return `RULE ${label.value}`
}
