import { ArrowLeft, BookOpen, CircleHelp, MessageSquareText, Newspaper, ScrollText, ShieldCheck, Sticker, Watch } from "lucide-react"
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
  readonly onOpenContent?: () => void
}

export function More({
  onBack,
  onOpenMinji,
  onOpenGuide,
  onOpenAccount,
  onOpenRestore,
  feedbackAvailable = feedbackConfig() !== null,
  onOpenContent,
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
        <UtilityRow icon={CircleHelp} label="훈련 용어집·도움말" detail="전문 용어의 쉬운 뜻과 이름의 이유, 앱 사용법을 확인해요" onClick={onOpenGuide} />
        {onOpenContent !== undefined && <UtilityRow icon={Newspaper} label="요즘 주목받는 훈련법" detail="유행 이름보다 근거와 사용 범위를 먼저 봐요" onClick={onOpenContent} />}
        <a className="more-screen__row" href="?feedback=1">
          <MessageSquareText aria-hidden="true" size={19} />
          <span><strong>문의 게시판</strong><small>{feedbackAvailable ? "불편한 점을 일지 내용 없이 남겨요" : "지금은 준비 중이에요. 열리면 앱 안에서 알려드려요"}</small></span>
        </a>
        <a className="more-screen__row" href="./support.html" target="_blank" rel="noreferrer">
          <Watch aria-hidden="true" size={19} />
          <span><strong>기기 연동 상태</strong><small>Garmin·COROS 신청 현황과 파일 가져오기를 확인해요</small></span>
        </a>
        <a className="more-screen__row" href="./legal/privacy.html" target="_blank" rel="noreferrer">
          <ShieldCheck aria-hidden="true" size={19} />
          <span><strong>개인정보처리방침</strong><small>어떤 정보를 왜 사용하는지 확인해요</small></span>
        </a>
        <a className="more-screen__row" href="./legal/terms.html" target="_blank" rel="noreferrer">
          <ScrollText aria-hidden="true" size={19} />
          <span><strong>이용약관</strong><small>계정·기기 저장·훈련 계획 이용 기준을 확인해요</small></span>
        </a>
        <a className="more-screen__row" href="./legal/open-source.html" target="_blank" rel="noreferrer">
          <Sticker aria-hidden="true" size={19} />
          <span><strong>스티커·오픈소스 출처</strong><small>귀여운 스티커의 원본과 이용 조건을 확인해요</small></span>
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
