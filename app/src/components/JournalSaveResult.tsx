import React from "react"
import { Check, Clock3 } from "lucide-react"
import type { ShellToastState } from "./AppShellFrame"
import { receiptPresentation } from "./AppChrome"
import { TaskFlowStep } from "./TaskFlowStep"
import { registerBrowserBackLayer } from "../navigation/browserNavigation"
import { localJournalScopeGeneration } from "../domain/account/local-journal-ownership"
import { ContextualIllustration } from "./ContextualIllustration"

/** An acknowledged save (or safely retained pending write), never an exercise award. */
export function JournalSaveResult({ result, onClose, onOpenSaved, onDecorateSaved, onOpenTrends, onRetryReward,
  summary, children, additionalActions, closeLabel = "닫기", manageBrowserBack = true }: {
  readonly result: ShellToastState
  readonly onClose: () => void
  readonly onOpenSaved?: () => void
  readonly onDecorateSaved?: () => void
  readonly onOpenTrends?: () => void
  readonly onRetryReward?: () => void
  readonly summary?: React.ReactNode
  readonly children?: React.ReactNode
  readonly additionalActions?: React.ReactNode
  readonly closeLabel?: string
  /** An embedded flow may already own its browser-back and completion route. */
  readonly manageBrowserBack?: boolean
}) {
  const presentation = receiptPresentation(result.receipt)
  const closeRef = React.useRef(onClose)
  closeRef.current = onClose
  const layerRef = React.useRef<ReturnType<typeof registerBrowserBackLayer> | null>(null)
  const id = React.useId()
  React.useEffect(() => {
    if (!manageBrowserBack) return
    const scope = localJournalScopeGeneration()
    const layer = registerBrowserBackLayer({ id: `save-result-${id}`, canClose: () => true,
      onClose: () => { if (scope === localJournalScopeGeneration()) closeRef.current() } })
    layerRef.current = layer
    return () => { layerRef.current = null; layer.dispose() }
  }, [id, manageBrowserBack])
  const close = () => layerRef.current ? layerRef.current.close() : onClose()
  const needsReview = result.reviewMessage !== undefined
  // The domain-provided storage message is authoritative. Do not turn a pending
  // or conflict result into a green check merely because the form closed.
  const confirmed = result.storageStatus === "CONFIRMED"
    || (result.storageStatus === undefined && result.storageMessage === undefined)

  return <div className="journal-save-result" data-storage-state={confirmed ? "confirmed" : "pending"}>
    <TaskFlowStep stepKey={`saved-${result.receipt.savedDate}`} title={result.storageMessage ?? presentation.title}
      headingAccessory={confirmed && !needsReview ? <ContextualIllustration image="journal-saved" size="medium" /> : undefined}
      actions={<>
        {onOpenSaved && <button type="button" className="journal-save-result__primary" onClick={onOpenSaved}>기록 보기</button>}
        <button type="button" className="journal-save-result__secondary" onClick={close}>{closeLabel}</button>
      </>}>
      {(!confirmed || needsReview || result.receipt.kind !== "generic") && <div className="journal-save-result__intro">
        <div className="journal-save-result__intro-copy">
          <div className="journal-save-result__mark" aria-hidden="true" data-storage-state={confirmed ? "confirmed" : "pending"}>{confirmed ? <Check size={20} /> : <Clock3 size={20} />}</div>
          {needsReview
            ? <p role="alert">분석 결과를 확인해야 해요. {result.reviewMessage}</p>
            : result.receipt.kind !== "generic" && <p>{presentation.detail}</p>}
        </div>
      </div>}
      {result.rewardMessage && <div className="journal-save-result__reward">
        <p role="status">{result.rewardMessage}</p>
        {result.rewardRetry && onRetryReward && <button type="button" disabled={result.rewardLoading} onClick={onRetryReward}>
          {result.rewardLoading ? "포인트 확인 중" : "포인트 다시 확인"}
        </button>}
      </div>}
      {summary && <div className="journal-save-result__summary">{summary}</div>}
      {children}
      {!needsReview && <div className="journal-save-result__optional">
        {onDecorateSaved && <button type="button" onClick={onDecorateSaved}>일지 꾸미기</button>}
        {presentation.actionLabel && result.receipt.kind !== "generic" && onOpenTrends
          && <button type="button" onClick={onOpenTrends}>{presentation.actionLabel}</button>}
      </div>}
      {additionalActions}
    </TaskFlowStep>
  </div>
}
