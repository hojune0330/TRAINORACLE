import { ArrowLeft } from "lucide-react"
import { EasyFaq } from "./faq/EasyFaq"
import { MinjiJournal } from "./minji/MinjiJournal"

export type GuideProps = {
  readonly initialSection?: "all" | "guide" | "minji"
  readonly onBack?: () => void
  readonly onWriteLog?: () => void
}

export function Guide({ initialSection = "all", onBack, onWriteLog }: GuideProps) {
  return (
    <div className="guide-screen">
      {onBack !== undefined && (
        <button className="guide-screen__back" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} />더보기로 돌아가기
        </button>
      )}
      {(initialSection === "all" || initialSection === "minji") && <MinjiJournal onWriteLog={onWriteLog} />}
      {(initialSection === "all" || initialSection === "guide") && (
        <>
          <EasyFaq />
          <FeedbackEntry />
        </>
      )}
    </div>
  )
}

function FeedbackEntry() {
  return (
    <section className="guide-feedback" aria-labelledby="guide-feedback-title">
      <h2 id="guide-feedback-title">불편한 점이 있었나요?</h2>
      <p>알려주신 내용부터 살펴보고 고쳐요. 일지 내용은 자동으로 보내지 않아요.</p>
      <a href="?feedback=1" data-testid="contact-link">문의 게시판 열기</a>
    </section>
  )
}
