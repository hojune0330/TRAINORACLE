import type { PlanSession } from "@impl/plan-generator/types"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import { planPrescriptionBasis } from "../../domain/plan-prescription-basis"

export function PlanPrescriptionBasis({ sessions, confirmationPending = false }: {
  readonly sessions: readonly PlanSession[]
  readonly confirmationPending?: boolean
}) {
  const basis = planPrescriptionBasis(sessions, confirmationPending)
  return <InfoDisclosure title={`처방 기준 · ${basis.label}`}><p>{basis.detail}</p></InfoDisclosure>
}
