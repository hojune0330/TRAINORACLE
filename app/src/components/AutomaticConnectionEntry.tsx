import { useId } from "react"
import { Watch } from "lucide-react"
import { CategoryCard } from "./CategoryCard"
import "../styles/automatic-connection-entry.css"

export function AutomaticConnectionEntry({ onOpen, description = "워치 자동 연결 · 받은 운동 확인 · 파일 가져오기", label = "자동연동 추천" }: {
  readonly onOpen: () => void
  readonly description?: string
  readonly label?: string
}) {
  const descriptionId = useId()
  return <CategoryCard category="record" icon={Watch} title="운동 가져오기" label={label}
    className="automatic-connection-entry" aria-label="운동 가져오기"
    aria-describedby={description ? descriptionId : undefined}
    description={description ? <span id={descriptionId}>{description}</span> : undefined}
    onClick={event => { event.currentTarget.focus({ preventScroll: true }); onOpen() }} />
}
