// balance.ts — 훈련 구성 균형 피드백 (데모 기준)
//
// ⚠️ 경계 선언 (Round 5 T5-3, ORDER_005 Task B 계약과 연동):
//  - 이 모듈은 "참고 표시 전용"이다. 안전 판정이 아니다.
//  - '과다'가 떠도 훈련을 막지 않고, '균형'이어도 D9/Safety Gate 차단을 풀지 않는다.
//  - 아래 기준값은 전부 placeholder_demo — COMPOSITION_BALANCE_BASELINE_CONTRACT.md
//    (ORDER_005 Task B)가 수용되기 전까지 UI는 반드시 `기준: 데모` 배지를 유지한다.

export type BalanceState = "below_range" | "in_range" | "above_range"

export interface BalanceHintData {
  state: Exclude<BalanceState, "in_range"> // in_range면 마커 자체가 없다(침묵)
  /** 무엇이 (탭카드 1행) */
  title: string
  /** 얼마나 벗어났는지 (탭카드 2행) */
  detail: string
  /** 관련 신호 1개 (탭카드 3행) */
  signal: string
}

/** Task B 계약 수용 시 이 값을 계약 basis로 교체 */
export const BALANCE_BASIS_LABEL = "기준: 데모"

export type TrendRange = "week" | "month" | "season" | "year"

// ── 데모 기준값 (placeholder_demo) ──────────────────────────
// 강도 비중 권장 범위(%): 저강도 다수 원칙의 데모 근사치. 확정 아님.
const INTENSITY_DEMO_RANGE: Record<string, [number, number] | null> = {
  base: [65, 85], // 저강도(Base) 비중
  lt: [10, 20],   // 역치(LT)
  vo2: [5, 12],   // 고강도(VO2)
  rest: null,     // 회복은 기준 없음 — 마커 침묵
}

const INTENSITY_LABEL: Record<string, string> = {
  base: "저강도(Base) 비중",
  lt: "역치(LT) 비중",
  vo2: "고강도(VO2) 비중",
  rest: "회복 비중",
}

const INTENSITY_SIGNAL: Record<string, { below: string; above: string }> = {
  base: {
    below: "기반 유산소가 얇으면 뒤 기간 회복이 느려질 수 있어요",
    above: "저강도만 길면 자극 다양성이 줄어요",
  },
  lt: {
    below: "역치 자극이 적으면 레이스 페이스 유지가 어려울 수 있어요",
    above: "역치 과다는 피로 누적과 함께 오는 경우가 많아요",
  },
  vo2: {
    below: "고강도 자극이 적은 기간이에요",
    above: "RPE 평균 상승(+0.4)과 같이 나타나고 있어요",
  },
}

/**
 * 강도 분포 항목 1개의 균형 상태. in_range면 null (마커 없음).
 * range별 차등: 주간은 표본이 짧아 판정 침묵(week → null) — 데모 규칙.
 */
export function intensityBalance(key: string, pct: number, range: TrendRange): BalanceHintData | null {
  if (range === "week") return null // 짧은 기간엔 비중 판정 침묵 (데모 규칙)
  const band = INTENSITY_DEMO_RANGE[key]
  if (!band) return null
  const [lo, hi] = band
  if (pct >= lo && pct <= hi) return null
  const sig = INTENSITY_SIGNAL[key]
  if (pct < lo) {
    return {
      state: "below_range",
      title: `${INTENSITY_LABEL[key]} 부족`,
      detail: `현재 ${pct}% — 데모 권장 ${lo}~${hi}%보다 ${lo - pct}%p 낮아요`,
      signal: sig?.below ?? "관련 신호 없음",
    }
  }
  return {
    state: "above_range",
    title: `${INTENSITY_LABEL[key]} 과다`,
    detail: `현재 ${pct}% — 데모 권장 ${lo}~${hi}%보다 ${pct - hi}%p 높아요`,
    signal: sig?.above ?? "관련 신호 없음",
  }
}

/**
 * 주간 거리 증가율 스파이크. 과다(△)만 표시 — 부족 마커 없음.
 * range별 차등: 주/월에서만 의미(데모 규칙). 시즌·연도는 null.
 */
export function distanceRampBalance(weeklyKm: number[], weekLabels: string[], range: TrendRange): BalanceHintData | null {
  if (range !== "week" && range !== "month") return null
  const DEMO_RAMP_LIMIT = 10 // % — placeholder_demo
  let worst: { pct: number; from: string; to: string } | null = null
  for (let i = 1; i < weeklyKm.length; i++) {
    const prev = weeklyKm[i - 1]
    const cur = weeklyKm[i]
    if (prev === undefined || cur === undefined || prev <= 0) continue
    const pct = Math.round(((cur - prev) / prev) * 100)
    if (pct > DEMO_RAMP_LIMIT && (!worst || pct > worst.pct)) {
      worst = { pct, from: weekLabels[i - 1] ?? "?", to: weekLabels[i] ?? "?" }
    }
  }
  if (!worst) return null
  return {
    state: "above_range",
    title: "주간 거리 증가율 과다",
    detail: `${worst.from}→${worst.to} +${worst.pct}% — 데모 상한 +${DEMO_RAMP_LIMIT}%를 넘었어요`,
    signal: "급증 주 다음엔 통증·피로 신호를 더 자주 확인해 주세요",
  }
}
