import React from "react"
import { ArrowLeft, BookOpen, Calculator, ChevronRight, CircleHelp, DatabaseBackup, Flag, MessageSquareText, Newspaper, ScrollText, ShieldCheck, Sticker, Trash2, UserRound, Watch } from "lucide-react"
import { DataSafetyNotice } from "../components/DataSafetyNotice"
import { feedbackConfig } from "../domain/feedback/feedback-config"
import { SafeJournalExport } from "./home/DeviceJournal"
import { InstallShortcutMenuEntry } from "../components/InstallShortcut"
import { TrashBin } from "./home/TrashBin"
import { loadTrash } from "../domain/journal-trash"
import "../styles/home-menu.css"
import { captureReaderPosition, restoreReaderPosition, type ReaderPosition } from "../navigation/readerPosition"
import { useNavigationReturnFrame } from "../hooks/useNavigationReturnFrame"

export type MoreView = "tools" | "learning" | "account" | "backup" | "about"

const VIEW_TITLES: Record<MoreView, string> = {
  tools: "더보기", learning: "훈련 배우기·일지 꾸미기", account: "계정·기록 보관",
  backup: "백업·복원·휴지통", about: "앱 정보·개인정보·문의",
}

export type MoreProps = {
  readonly view?: MoreView
  readonly onViewChange?: (view: MoreView) => void
  readonly onBack: () => void
  readonly onOpenMinji: () => void
  readonly onOpenGuide: () => void
  readonly onOpenAccount?: () => void
  readonly onOpenRestore?: () => void
  readonly feedbackAvailable?: boolean
  readonly onOpenFeedback?: () => void
  readonly onOpenContent?: () => void
  readonly onOpenRewards?: () => void
  readonly onOpenPaceCalculator?: () => void
  readonly onOpenRunningProfile?: () => void
  readonly onOpenRecordReading?: () => void
  readonly onOpenOracleLibrary?: () => void
  readonly onOpenRecords?: () => void
  readonly onOpenImport?: () => void
}

export function More({
  view,
  onViewChange,
  onBack,
  onOpenMinji,
  onOpenGuide,
  onOpenAccount,
  onOpenRestore,
  feedbackAvailable = feedbackConfig() !== null,
  onOpenFeedback,
  onOpenContent,
  onOpenRewards,
  onOpenPaceCalculator,
  onOpenRunningProfile,
  onOpenRecordReading,
  onOpenOracleLibrary,
  onOpenRecords,
  onOpenImport,
}: MoreProps) {
  const [internalView, setInternalView] = React.useState<MoreView>("tools")
  const activeView = view ?? internalView
  const heading = React.useRef<HTMLHeadingElement>(null)
  const previousView = React.useRef<MoreView | null>(null)
  const menuReturn = React.useRef<ReaderPosition | null>(null)
  const { schedule } = useNavigationReturnFrame()
  const readerRegion = () => heading.current?.closest<HTMLElement>(".app-scroll-region") ?? heading.current?.closest<HTMLElement>(".more-screen") ?? null
  const changeView = (next: MoreView) => {
    if (activeView === "tools" && next !== "tools") menuReturn.current = captureReaderPosition(readerRegion())
    setInternalView(next)
    onViewChange?.(next)
  }
  React.useEffect(() => {
    if (previousView.current === activeView) return
    previousView.current = activeView
    if (activeView === "tools" && menuReturn.current) {
      const position = menuReturn.current
      menuReturn.current = null
      schedule(() => restoreReaderPosition(readerRegion(), position))
    } else heading.current?.focus({ preventScroll: true })
  }, [activeView, schedule])
  const [trashCount, setTrashCount] = React.useState(() => loadTrash().length)
  return (
    <div className="more-screen">
      <header className="utility-header">
        <button type="button" onClick={() => activeView === "tools" ? onBack() : changeView("tools")} aria-label={activeView === "tools" ? "홈으로 돌아가기" : "더보기로 돌아가기"} title="뒤로">
          <ArrowLeft aria-hidden="true" size={19} />
        </button>
        <div>
          <div className="utility-header__eyebrow">TRAINORACLE</div>
          <h1 ref={heading} tabIndex={-1}>{VIEW_TITLES[activeView]}</h1>
        </div>
      </header>

      <div className="more-screen__list">
        {activeView === "tools" && <>
        {(onOpenPaceCalculator || onOpenImport || onOpenRecords) && <h2 className="more-screen__group-label">훈련 도구</h2>}
        {onOpenPaceCalculator && <UtilityRow icon={Calculator} label="페이스 계산" onClick={onOpenPaceCalculator} />}
        {onOpenRecords && <UtilityRow icon={Flag} label="경기 기록 추가·수정" onClick={onOpenRecords} />}
        {onOpenImport && <UtilityRow icon={Watch} label="워치 파일 가져오기" onClick={onOpenImport} />}
        {(onOpenRunningProfile || onOpenRecordReading || onOpenOracleLibrary) && <h2 className="more-screen__group-label">오라클</h2>}
        {onOpenRunningProfile && <UtilityRow icon={UserRound} label="러닝 취향" detail="취향 점수 · 친구와 비교" onClick={onOpenRunningProfile} />}
        {onOpenRecordReading && <UtilityRow icon={Calculator} label="최고기록으로 풀이하기" detail="저장 없이 내 기록·친구 기록 비교" onClick={onOpenRecordReading} />}
        {onOpenOracleLibrary && <UtilityRow icon={BookOpen} label="오라클 읽을거리" onClick={onOpenOracleLibrary} />}
        <h2 className="more-screen__group-label">훈련 배우기</h2>
        <UtilityRow icon={BookOpen} label="민지의 예시 일지" onClick={onOpenMinji} />
        <UtilityRow icon={CircleHelp} label="훈련 용어집·도움말" onClick={onOpenGuide} />
        {onOpenContent && <UtilityRow icon={Newspaper} label="훈련법 읽기" onClick={onOpenContent} />}
        {onOpenRewards && <>
          <h2 className="more-screen__group-label">일지 꾸미기</h2>
          <UtilityRow icon={Sticker} label="일지 꾸미기" detail="달력 꾸미기 · 포인트는 재료에서 확인" onClick={onOpenRewards} />
        </>}
        <h2 className="more-screen__group-label">관리·도움말</h2>
        <UtilityRow icon={UserRound} label={VIEW_TITLES.account} onClick={() => changeView("account")} />
        <UtilityRow icon={DatabaseBackup} label={VIEW_TITLES.backup} onClick={() => changeView("backup")} />
        <UtilityRow icon={ShieldCheck} label={VIEW_TITLES.about} detail="기기 연동 상태 · 약관 · 출처" onClick={() => changeView("about")} />
        </>}
        {activeView === "learning" && <>
        <UtilityRow icon={BookOpen} label="민지의 예시 일지" onClick={onOpenMinji} />
        <UtilityRow icon={CircleHelp} label="훈련 용어집·도움말" onClick={onOpenGuide} />
        {onOpenContent !== undefined && <UtilityRow icon={Newspaper} label="훈련법 읽기" onClick={onOpenContent} />}
        {onOpenRewards !== undefined && <UtilityRow icon={Sticker} label="일지 꾸미기" detail="달력 꾸미기 · 포인트는 재료에서 확인" onClick={onOpenRewards} />}
        </>}
        {activeView === "account" && <>
        {onOpenAccount && <UtilityRow icon={UserRound} label="계정 저장 상태 확인" onClick={onOpenAccount} />}
        <InstallShortcutMenuEntry />
        <DataSafetyNotice onOpenAccount={onOpenAccount} />
        </>}
        {activeView === "backup" && <>
        <SafeJournalExport onOpenRestore={onOpenRestore} />
        <details className="more-screen__trash">
          <summary><Trash2 size={19} aria-hidden="true" /><span>휴지통 · {trashCount}개</span></summary>
          {trashCount === 0 ? <p>지운 일지가 없어요.</p> : <TrashBin onChanged={() => setTrashCount(loadTrash().length)} />}
        </details>
        </>}
        {activeView === "about" && <>
        {onOpenFeedback === undefined ? (
          <a className="more-screen__row" href="?feedback=1">
            <MessageSquareText aria-hidden="true" size={19} />
            <span><strong>문의 게시판</strong>{!feedbackAvailable && <small>준비 중</small>}</span>
          </a>
        ) : (
          <UtilityRow icon={MessageSquareText} label="문의 게시판" detail={feedbackAvailable ? undefined : "준비 중"} onClick={onOpenFeedback} />
        )}
        <a className="more-screen__row" href="./support.html" target="_blank" rel="noreferrer">
          <Watch aria-hidden="true" size={19} />
          <span><strong>기기 연동 상태</strong><small>Garmin · COROS</small></span>
        </a>
        <a className="more-screen__row" href="./legal/privacy.html" target="_blank" rel="noreferrer">
          <ShieldCheck aria-hidden="true" size={19} />
          <span><strong>개인정보처리방침</strong></span>
        </a>
        <a className="more-screen__row" href="./legal/terms.html" target="_blank" rel="noreferrer">
          <ScrollText aria-hidden="true" size={19} />
          <span><strong>이용약관</strong></span>
        </a>
        <a className="more-screen__row" href="./legal/open-source.html" target="_blank" rel="noreferrer">
          <Sticker aria-hidden="true" size={19} />
          <span><strong>스티커·오픈소스 출처</strong></span>
        </a>
        </>}
      </div>

    </div>
  )
}

function UtilityRow({ icon: Icon, label, detail, onClick }: {
  readonly icon: typeof BookOpen
  readonly label: string
  readonly detail?: string
  readonly onClick: () => void
}) {
  const descriptionId = React.useId()
  return (
    <button className="more-screen__row app-choice-control" type="button" onClick={event => { event.currentTarget.focus({ preventScroll: true }); onClick() }} aria-label={label} aria-describedby={detail ? descriptionId : undefined}>
      <Icon aria-hidden="true" size={19} />
      <span><strong>{label}</strong>{detail && <small id={descriptionId}>{detail}</small>}</span>
      <ChevronRight aria-hidden="true" size={18} />
    </button>
  )
}
