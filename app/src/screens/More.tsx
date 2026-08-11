import { ArrowLeft, BookOpen, CircleHelp, MessageSquareText } from "lucide-react"
import { DataSafetyNotice } from "../components/DataSafetyNotice"
import { feedbackConfig } from "../domain/feedback/feedback-config"
import { SafeJournalExport } from "./home/DeviceJournal"

export type MoreProps = {
  readonly onBack: () => void
  readonly onOpenMinji: () => void
  readonly onOpenGuide: () => void
  readonly onOpenAccount?: () => void
  readonly onOpenRestore?: () => void
  readonly feedbackAvailable?: boolean
}

export function More({
  onBack,
  onOpenMinji,
  onOpenGuide,
  onOpenAccount,
  onOpenRestore,
  feedbackAvailable = feedbackConfig() !== null,
}: MoreProps) {
  return (
    <div className="more-screen">
      <header className="utility-header">
        <button type="button" onClick={onBack} aria-label="홈으로 돌아가기" title="뒤로">
          <ArrowLeft aria-hidden="true" size={19} />
        </button>
        <div>
          <div className="utility-header__eyebrow">TRAINORACLE</div>
          <h1>더보기</h1>
        </div>
      </header>

      <div className="more-screen__list">
        <UtilityRow icon={BookOpen} label="민지의 예시 일지" detail="기록이 쌓이는 모습을 한 장씩 구경해요" onClick={onOpenMinji} />
        <UtilityRow icon={CircleHelp} label="쉬운 도움말과 FAQ" detail="무료 이용·메모·계획을 쉬운 말로 확인해요" onClick={onOpenGuide} />
        <a className="more-screen__row" href="?feedback=1">
          <MessageSquareText aria-hidden="true" size={19} />
          <span><strong>문의 게시판</strong><small>{feedbackAvailable ? "불편한 점을 일지 내용 없이 남겨요" : "지금은 준비 중이에요. 열리면 앱 안에서 알려드려요"}</small></span>
        </a>
      </div>

      <DataSafetyNotice onOpenAccount={onOpenAccount} />
      <SafeJournalExport onOpenRestore={onOpenRestore} />
    </div>
  )
}

function UtilityRow({ icon: Icon, label, detail, onClick }: {
  readonly icon: typeof BookOpen
  readonly label: string
  readonly detail: string
  readonly onClick: () => void
}) {
  return (
    <button className="more-screen__row" type="button" onClick={onClick} aria-label={label}>
      <Icon aria-hidden="true" size={19} />
      <span><strong>{label}</strong><small>{detail}</small></span>
    </button>
  )
}
