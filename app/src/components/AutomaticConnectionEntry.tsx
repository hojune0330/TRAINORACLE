import { useId } from "react"
import { Watch } from "lucide-react"
import { CategoryCard } from "./CategoryCard"
import "../styles/automatic-connection-entry.css"

export function AutomaticConnectionEntry({ onOpen, description = "워치를 연결하고 새 운동을 자동으로 가져오세요", label = "추천" }: {
  readonly onOpen: () => void
  readonly description?: string
  readonly label?: string
}) {
  const descriptionId = useId()
  return <CategoryCard category="record" icon={Watch} title="운동 자동연동" label={label}
    className="automatic-connection-entry" aria-label="운동 자동연동"
    aria-describedby={description ? descriptionId : undefined}
    description={description ? <span id={descriptionId}>{description}</span> : undefined}
    onClick={event => { event.currentTarget.focus({ preventScroll: true }); onOpen() }} />
}
