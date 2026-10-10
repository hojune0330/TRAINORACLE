import React from "react"
import { ArrowLeft } from "lucide-react"
import { useTaskFlowBack } from "../hooks/useTaskFlowBack"
import { localJournalScopeGeneration } from "../domain/account/local-journal-ownership"
import { feedbackConfig } from "../domain/feedback/feedback-config"
import { EasyFaq, feedbackAvailabilityMessage } from "./faq/EasyFaq"
import { MinjiJournal } from "./minji/MinjiJournal"
import { TrainingLexicon } from "./TrainingLexicon"

export type GuideProps = {
  readonly initialSection?: "all" | "guide" | "minji"
  readonly onBack?: () => void
  readonly backLabel?: string
  readonly onWriteLog?: () => void
  readonly feedbackAvailable?: boolean
  readonly onOpenFeedback?: () => void
}

export function Guide({ initialSection = "all", onBack, backLabel = "더보기로 돌아가기", onWriteLog, feedbackAvailable = feedbackConfig() !== null, onOpenFeedback }: GuideProps) {
  const root = React.useRef<HTMLDivElement>(null)
  const [guidePurpose, setGuidePurpose] = React.useState<"terms" | "app">("terms")
  useTaskFlowBack({ enabled: onBack !== undefined, onBack: () => {
    const scope = localJournalScopeGeneration()
    // Restore after the shell has finished notifying this native navigation.
    queueMicrotask(() => { if (scope === localJournalScopeGeneration()) onBack?.() })
  } })
  React.useEffect(() => {
    const title = root.current?.querySelector<HTMLElement>("h1, h2")
    if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }) }
  }, [initialSection])
  return (
    <div className="guide-screen" ref={root}>
      {onBack !== undefined && (
        <button className="guide-screen__back" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} />{backLabel}
        </button>
      )}
      {(initialSection === "all" || initialSection === "minji") && <MinjiJournal onWriteLog={onWriteLog} />}
      {(initialSection === "all" || initialSection === "guide") && (
        <>
          <div className="guide-screen__purpose app-choice-group" role="group" aria-label="도움말 종류">
            <button className="app-choice-control" type="button" aria-pressed={guidePurpose === "terms"}
              aria-controls="guide-terms-content" onClick={() => setGuidePurpose("terms")}>훈련 용어</button>
            <button className="app-choice-control" type="button" aria-pressed={guidePurpose === "app"}
              aria-controls="guide-app-content" onClick={() => setGuidePurpose("app")}>앱 이용 안내</button>
          </div>
          <div id="guide-terms-content" hidden={guidePurpose !== "terms"}>
            <TrainingLexicon active={guidePurpose === "terms"} />
          </div>
          <div id="guide-app-content" hidden={guidePurpose !== "app"}>
            <EasyFaq feedbackAvailable={feedbackAvailable} headingLevel={initialSection === "guide" ? 1 : 2} />
            <FeedbackEntry available={feedbackAvailable} onOpen={onOpenFeedback} />
          </div>
        </>
      )}
    </div>
  )
}

function FeedbackEntry({ available, onOpen }: { readonly available: boolean; readonly onOpen?: () => void }) {
  return (
    <section className="guide-feedback" aria-labelledby="guide-feedback-title">
      <h2 id="guide-feedback-title">불편한 점이 있었나요?</h2>
      <p>{available
        ? `${feedbackAvailabilityMessage(available)} 알려주신 내용만 보내며, 일지 내용은 자동으로 보내지 않아요.`
        : feedbackAvailabilityMessage(available)}
      </p>
      {onOpen === undefined
        ? <a href="?feedback=1" data-testid="contact-link">{available ? "문의 게시판 열기" : "문의 게시판 상태 보기"}</a>
        : <button type="button" onClick={onOpen} data-testid="contact-link">{available ? "문의 게시판 열기" : "문의 게시판 상태 보기"}</button>}
    </section>
  )
}
