import { ChevronRight, Flag, Watch } from "lucide-react"
import "./record-start.css"

export function RecordStartActions({ onImport, onRecords }: {
  readonly onImport?: (() => void) | undefined
  readonly onRecords?: (() => void) | undefined
}) {
  if (!onImport && !onRecords) return null
  return <section className="record-start" aria-label="이미 있는 기록으로 시작하기">
    <nav aria-label="기록 가져오기 또는 최고기록 입력">
      {onImport && <button type="button" onClick={onImport}><Watch size={18} aria-hidden="true" /><strong>운동 파일 가져오기</strong><ChevronRight size={18} aria-hidden="true" /></button>}
      {onRecords && <button type="button" onClick={onRecords}><Flag size={18} aria-hidden="true" /><strong>최고기록 남기기</strong><ChevronRight size={18} aria-hidden="true" /></button>}
    </nav>
  </section>
}
