import type { PlanSession } from "@impl/plan-generator/types"
import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout } from "@impl/prescription/all-workout-calculator"
import type { CalculatedWorkout } from "@impl/prescription/all-workout-calculator"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { catalogRequirementLabels } from "./catalog-schedule-conditions"
import type { InitialMainReview } from "./initial-main-conditions"

export type PrescriptionSupplyFlag = "detailed_applied" | "confirmation_pending" | "condition_needed" | "input_needed" | "time_rpe_guidance" | "check_failed"
export type PrescriptionSupplySlot = {
  readonly day: number
  readonly slot: "AM" | "PM"
  readonly flags: readonly PrescriptionSupplyFlag[]
  readonly title: string
  readonly detail: string
  readonly catalogId?: string
  readonly calculation?: CalculatedWorkout
  readonly confirmationPending: boolean
  readonly templateVerification: "verified" | "unknown" | "not_applicable"
}

const conditionLabels: Record<string, string> = { ...catalogRequirementLabels,
  EVENT_SCOPE: "종목 조건 확인 필요", EXPERIENCE_SCOPE: "경험 조건 확인 필요" }
const inputLabels: Record<string, string> = {
  RACE_PACE_REFERENCE_REQUIRED: "실제 목표 페이스 입력 필요", WORK_DURATION_NOT_FIXED: "구간 시간 입력 필요",
  RECOVERY_DURATION_NOT_FIXED: "회복 시간 입력 필요", RECOVERY_DISTANCE_WITHOUT_PACE: "회복 페이스 입력 필요",
  TIME_BUDGET_UNCONFIRMED: "총시간 확인 필요", RECORD_NOT_CURRENT: "유효한 현재 기록 입력 필요",
}

function unique(values: readonly string[]) { return [...new Set(values)] }
function validSlot(session: PlanSession) {
  return session.role === "QUALITY" && Number.isInteger(session.day) && session.day > 0
    && (session.slot === "AM" || session.slot === "PM")
}

/** Read-only supply facts for the generated QUALITY slots. Does not discover or bind replacement workouts. */
export function planPrescriptionSupply(sessions: readonly PlanSession[], options: {
  readonly prescriptionBinding?: { readonly kind?: string; readonly code?: string }
  readonly confirmationPending?: boolean
  readonly initialReview?: Pick<InitialMainReview, "offers" | "fallbacks">
  readonly verifiedDetailedSlots?: readonly { readonly day: number; readonly slot: "AM" | "PM" }[]
} = {}): readonly PrescriptionSupplySlot[] {
  return sessions.filter(validSlot).map(session => {
    const base = { day: session.day, slot: session.slot, confirmationPending: options.confirmationPending === true }
    const initialOffer = options.initialReview?.offers.some(row => row.day === session.day && row.slot === session.slot)
    const initialFallback = options.initialReview?.fallbacks.find(row => row.day === session.day && row.slot === session.slot)
    const p = session.prescription
    if (p.kind === "PACE_TARGET") {
      const verified = options.verifiedDetailedSlots?.some(row => row.day === session.day && row.slot === session.slot) === true
      return verified
        ? { ...base, templateVerification: "verified" as const, flags: (base.confirmationPending ? ["confirmation_pending"] : ["detailed_applied"]) as PrescriptionSupplyFlag[],
          title: "기존 승인 템플릿", detail: base.confirmationPending ? "상세 처방 미리보기 · 확인 후 적용할 수 있어요." : "기존 승인 템플릿의 상세 처방이 연결돼 있어요." }
        : { ...base, templateVerification: "unknown" as const, flags: ["check_failed"] as const, title: "상세 템플릿 확인 필요", detail: "승인된 템플릿 여부를 다시 확인할 수 없어요." }
    }
    if (p.kind !== "RPE_TIME_RANGE") {
      return { ...base, templateVerification: "not_applicable" as const, flags: ["check_failed"] as const, title: "처방 확인 필요", detail: "이 슬롯의 처방 형식을 확인할 수 없어요." }
    }
    const binding = p.catalogWorkout
    if (!binding) {
      const bindingFailed = options.prescriptionBinding?.kind === "fallback"
        && !!options.prescriptionBinding.code && !["PACE_TARGET_FALLBACK_NO_EXPLICIT_TEMPLATE", "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR"].includes(options.prescriptionBinding.code)
      if (initialOffer) return { ...base, templateVerification: "not_applicable" as const, flags: ["condition_needed"] as const,
        title: "훈련 장소·공간 확인", detail: "현재 후보에는 상세 구성이 연결되지 않았어요. 날짜별 장소와 공간 조건을 확인하면 상세 구성 제안을 검토할 수 있어요." }
      if (initialFallback?.reason === "EXPLICIT_SEGMENT_TIME_REQUIRED") return { ...base, templateVerification: "not_applicable" as const,
        flags: ["input_needed"] as const, title: "구간 시간 입력 필요", detail: "현재 시간과 힘든 정도 안내가 표시돼요. 구간 시간을 입력해야 하는 상세 구성 상태예요." }
      if (initialFallback) return { ...base, templateVerification: "not_applicable" as const, flags: ["time_rpe_guidance"] as const,
        title: "시간·힘든 정도 안내", detail: "현재 입력으로는 바로 연결할 상세 구성이 없어 시간과 힘든 정도 안내를 표시해요." }
      return bindingFailed
        ? { ...base, templateVerification: "not_applicable" as const, flags: ["time_rpe_guidance", "check_failed"] as const, title: "시간·힘든 정도 안내", detail: "요청한 상세 처방을 연결하지 못해 현재는 시간과 힘든 정도 안내가 표시돼요." }
        : { ...base, templateVerification: "not_applicable" as const, flags: ["time_rpe_guidance"] as const, title: "시간·힘든 정도 안내", detail: "현재 시간과 힘든 정도 안내가 표시돼요. 상세 훈련 구성은 연결되어 있지 않아요." }
    }
    let calculated: CalculatedWorkout | null = null
    try { calculated = calculateCatalogWorkout(binding.catalogId, binding.inputs) } catch { /* malformed data is reported below */ }
    const resolved = (() => { try { return resolveCatalogBinding(binding) } catch { return null } })()
    if (!calculated || calculated.catalogFingerprint !== binding.catalogFingerprint
      || calculated.fingerprint !== binding.calculationFingerprint) {
      return { ...base, templateVerification: "not_applicable" as const, flags: ["check_failed"] as const, title: "계산 확인 필요", detail: "저장된 연결과 현재 계산 결과가 일치하지 않아요." }
    }
    const entry = ALL_WORKOUT_CATALOG.find(row => row.id === binding.catalogId)
    const conditionCodes = new Set([...(entry?.requirements ?? []), ...(entry?.hold ? [entry.hold] : []), "EVENT_SCOPE", "EXPERIENCE_SCOPE"])
    const conditions = unique(calculated.unavailable.filter(code => conditionCodes.has(code)))
    const inputs = unique([...calculated.unavailable, ...calculated.unresolved].filter(code => inputLabels[code]))
    const flags: PrescriptionSupplyFlag[] = []
    if (conditions.length) flags.push("condition_needed")
    if (inputs.length) flags.push("input_needed")
    if (!resolved) {
      if (!flags.length) flags.push("check_failed")
      return { ...base, templateVerification: "not_applicable" as const, flags, title: ALL_WORKOUT_CATALOG.find(row => row.id === binding.catalogId)?.name ?? "상세 훈련 구성",
        detail: [...conditions.map(code => conditionLabels[code] ?? `조건 확인 필요 (${code})`), ...inputs.map(code => inputLabels[code]!),
          ...(flags.includes("check_failed") ? ["계산 결과를 검증할 수 없어요."] : [])].join(" · ") }
    }
    flags.unshift(base.confirmationPending ? "confirmation_pending" : "detailed_applied")
    return { ...base, templateVerification: "not_applicable" as const, flags, title: entry?.name ?? "상세 훈련 구성", catalogId: binding.catalogId, calculation: resolved,
      detail: base.confirmationPending ? "상세 계산 미리보기 · 확인 후 적용할 수 있어요." : "확인된 상세 구성이 이 훈련에 연결돼 있어요." }
  })
}
