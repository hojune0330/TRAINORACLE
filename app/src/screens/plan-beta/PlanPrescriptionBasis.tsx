import type { PlanSession } from "@impl/plan-generator/types"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import { planPrescriptionBasis } from "../../domain/plan-prescription-basis"

export function PlanPrescriptionBasis({ sessions, confirmationPending = false, inline = false }: {
  readonly sessions: readonly PlanSession[]
  readonly confirmationPending?: boolean
  readonly inline?: boolean
}) {
  const basis = planPrescriptionBasis(sessions, confirmationPending)
  const importantNotice = basis.importantNotice
    && <p className="plan-prescription-basis__notice" role="note">{basis.importantNotice}</p>
  const pending = basis.pendingNotice && <p className="plan-prescription-basis__pending" role="status">{basis.pendingNotice}</p>
  return inline
    ? <div className="plan-prescription-basis">
        <p className="plan-prescription-basis__summary">{basis.label}</p>
        <p className="plan-prescription-basis__detail">{basis.detail}</p>
        {importantNotice}
        {pending}
      </div>
    : <div className="plan-prescription-basis">
        <InfoDisclosure title="페이스 안내" preview={basis.label} purpose="actions" className="plan-prescription-basis__disclosure">
          <p className="plan-prescription-basis__detail">{basis.detail}</p>
        </InfoDisclosure>
        {importantNotice}
        {pending}
      </div>
}
