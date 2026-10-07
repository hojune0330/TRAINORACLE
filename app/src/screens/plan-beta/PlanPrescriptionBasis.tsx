import type { PlanSession } from "@impl/plan-generator/types"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import { planPrescriptionBasis } from "../../domain/plan-prescription-basis"

export function PlanPrescriptionBasis({ sessions, confirmationPending = false, inline = false }: {
  readonly sessions: readonly PlanSession[]
  readonly confirmationPending?: boolean
  readonly inline?: boolean
}) {
  const basis = planPrescriptionBasis(sessions, confirmationPending)
  const content = <><p>{basis.label}</p><p>{basis.detail}</p></>
  return inline ? content : <InfoDisclosure title="무엇을 기준으로 만든 훈련인가요?">{content}</InfoDisclosure>
}
