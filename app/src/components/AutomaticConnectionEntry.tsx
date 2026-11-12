import { useId } from "react"
import { Watch } from "lucide-react"
import "../styles/automatic-connection-entry.css"

export function AutomaticConnectionEntry({ onOpen, description, label }: {
  readonly onOpen: () => void
  readonly description?: string
  readonly label?: string
}) {
  const descriptionId = useId()
  return <button type="button" data-category="record"
    className="automatic-connection-entry" aria-label="운동 가져오기"
    aria-describedby={description ? descriptionId : undefined}
    onClick={event => { event.currentTarget.focus({ preventScroll: true }); onOpen() }}>
    <Watch size={16} aria-hidden="true" />
    <span className="automatic-connection-entry__copy"><span>운동 가져오기</span>
      {label && <span className="automatic-connection-entry__status">{label}</span>}
      {description && <span className="automatic-connection-entry__description" id={descriptionId}>{description}</span>}
    </span>
  </button>
}
