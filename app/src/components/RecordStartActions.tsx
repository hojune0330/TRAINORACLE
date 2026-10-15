import { Flag, Watch } from "lucide-react"
import { CategoryCard } from "./CategoryCard"
import "./record-start.css"

export function RecordStartActions({ onImport, onRecords }: {
  readonly onImport?: (() => void) | undefined
  readonly onRecords?: (() => void) | undefined
}) {
  if (!onImport && !onRecords) return null
  return <section className="record-start" aria-label="이미 있는 기록으로 시작하기">
    <nav aria-label="기록 가져오기 또는 최고기록 입력">
      {onImport && <CategoryCard category="record" icon={Watch} title="운동 파일 가져오기" onClick={onImport} />}
      {onRecords && <CategoryCard category="record" icon={Flag} title="최고기록 남기기" onClick={onRecords} />}
    </nav>
  </section>
}
