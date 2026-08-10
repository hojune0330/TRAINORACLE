import { ArrowLeft } from "lucide-react"
import { feedbackConfig } from "../domain/feedback/feedback-config"
import { EasyFaq } from "./faq/EasyFaq"
import { MinjiJournal } from "./minji/MinjiJournal"

export type GuideProps = {
  readonly initialSection?: "all" | "guide" | "minji"
  readonly onBack?: () => void
  readonly onWriteLog?: () => void
  readonly feedbackAvailable?: boolean
}

export function Guide({ initialSection = "all", onBack, onWriteLog, feedbackAvailable = feedbackConfig() !== null }: GuideProps) {
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
          <FeedbackEntry available={feedbackAvailable} />
        </>
      )}
    </div>
  )
}

function FeedbackEntry({ available }: { readonly available: boolean }) {
  return (
    <section className="guide-feedback" aria-labelledby="guide-feedback-title">
      <h2 id="guide-feedback-title">불편한 점이 있었나요?</h2>
      <p>{available
        ? "알려주신 내용부터 살펴보고 고쳐요. 일지 내용은 자동으로 보내지 않아요."
        : "문의 게시판은 지금 준비 중이에요. 열리면 앱 안에서 알려드릴게요."}
      </p>
      <a href="?feedback=1" data-testid="contact-link">{available ? "문의 게시판 열기" : "문의 게시판 상태 보기"}</a>
    </section>
  )
}
