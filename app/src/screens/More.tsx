import React from "react"
import { ArrowLeft, BookOpen, Calculator, CalendarDays, ChartNoAxesCombined, CircleHelp, CircleUserRound, Compass, DatabaseBackup, Flag, Gamepad2, Heart, Info, LibraryBig, MessageSquareText, NotebookPen, ScrollText, ShieldCheck, Sticker, Trash2, Watch } from "lucide-react"
import { AppHeading } from "../components/AppHeading"
import { MenuAction } from "../components/MenuAction"
import { DataSafetyNotice } from "../components/DataSafetyNotice"
import { feedbackConfig } from "../domain/feedback/feedback-config"
import { SafeJournalExport } from "./home/DeviceJournal"
import { InstallShortcutMenuEntry } from "../components/InstallShortcut"
import { TrashBin } from "./home/TrashBin"
import { loadTrash } from "../domain/journal-trash"
import "../styles/home-menu.css"
import { captureReaderPosition, restoreReaderPosition, type ReaderPosition } from "../navigation/readerPosition"
import { useNavigationReturnFrame } from "../hooks/useNavigationReturnFrame"
import { HomeIdentityArtwork } from "./home/HomeIntroduction"

export type MoreView = "tools" | "learning" | "account" | "backup" | "about" | "introduction"

const VIEW_TITLES: Record<MoreView, string> = {
  tools: "더보기", learning: "훈련 배우기", account: "계정·기록 보관",
  backup: "백업·복원·휴지통", about: "앱 정보·개인정보·문의", introduction: "앱 소개",
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
  readonly onOpenMinigame?: () => void
  readonly onOpenRewards?: () => void
  readonly onOpenPaceCalculator?: () => void
  readonly onOpenRunningProfile?: () => void
  readonly onOpenRecordReading?: () => void
  readonly onOpenOracleLibrary?: () => void
  readonly onOpenRecords?: () => void
  readonly onOpenImport?: () => void
  readonly onOpenPlan?: () => void
  readonly onOpenAnalysis?: () => void
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
  onOpenMinigame,
  onOpenRewards,
  onOpenPaceCalculator,
  onOpenRunningProfile,
  onOpenRecordReading,
  onOpenOracleLibrary,
  onOpenRecords,
  onOpenImport,
  onOpenPlan,
  onOpenAnalysis,
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
          <AppHeading as="h1" ref={heading} tabIndex={-1}>{VIEW_TITLES[activeView]}</AppHeading>
        </div>
      </header>

      <div className={`more-screen__list${activeView === "tools" ? " more-screen__list--tools" : ""}`}>
        {activeView === "tools" && <>
        {(onOpenPaceCalculator || onOpenImport || onOpenRecords) && <MenuGroup title="훈련 도구">
          {onOpenPaceCalculator && <MenuAction category="training" icon={Calculator} label="페이스 계산" illustration="pace-calculator-announcement" onClick={onOpenPaceCalculator} />}
          {onOpenRecords && <MenuAction category="record" icon={Flag} label="경기 기록 추가·수정" onClick={onOpenRecords} />}
          {onOpenImport && <MenuAction category="record" icon={Watch} label="워치 파일 가져오기" onClick={onOpenImport} />}
        </MenuGroup>}
        {(onOpenRunningProfile || onOpenRecordReading || onOpenOracleLibrary) && <MenuGroup title="오라클">
          {onOpenRunningProfile && <MenuAction category="oracle" icon={Heart} label="러닝 취향" onClick={onOpenRunningProfile} />}
          {onOpenRecordReading && <MenuAction category="oracle" icon={ChartNoAxesCombined} label="최고기록으로 풀이하기" onClick={onOpenRecordReading} />}
          {onOpenOracleLibrary && <MenuAction category="oracle" icon={BookOpen} label="오라클 읽을거리" onClick={onOpenOracleLibrary} />}
        </MenuGroup>}
        <MenuGroup title="배우기">
          <MenuAction category="journal" icon={BookOpen} label="일지 예시 보기" onClick={onOpenMinji} />
          <MenuAction category="training" icon={CircleHelp} label="훈련 용어집·도움말" onClick={onOpenGuide} />
          {onOpenContent && <MenuAction category="training" icon={BookOpen} label="훈련법 읽기" onClick={onOpenContent} />}
        </MenuGroup>
        {(onOpenRewards || onOpenMinigame) && <MenuGroup title="꾸미기·게임">
          {onOpenRewards && <MenuAction category="journal" icon={NotebookPen} label="일지 꾸미기" onClick={onOpenRewards} />}
          {onOpenMinigame && <MenuAction icon={Gamepad2} label="게임 라운지" illustration="running-game-announcement" onClick={onOpenMinigame} />}
        </MenuGroup>}
        <MenuGroup title="관리">
          <MenuAction icon={Compass} label={VIEW_TITLES.introduction} onClick={() => changeView("introduction")} />
          <MenuAction icon={CircleUserRound} label={VIEW_TITLES.account} onClick={() => changeView("account")} />
          <MenuAction icon={DatabaseBackup} label={VIEW_TITLES.backup} onClick={() => changeView("backup")} />
          <MenuAction icon={Info} label={VIEW_TITLES.about} onClick={() => changeView("about")} />
        </MenuGroup>
        </>}
        {activeView === "introduction" && <section className="more-screen__introduction" aria-labelledby="app-introduction-purpose">
          <HomeIdentityArtwork size={64} />
          <AppHeading as="h2" variant="section" id="app-introduction-purpose">운동을 분석하고 <br />훈련 계획을 세워요</AppHeading>
          <nav aria-label="앱의 주요 기능">
            {onOpenPlan && <MenuAction category="training" icon={CalendarDays} label="훈련 계획 보기" onClick={onOpenPlan} />}
            {onOpenAnalysis && <MenuAction category="oracle" icon={ChartNoAxesCombined} label="운동 분석 보기" onClick={onOpenAnalysis} />}
          </nav>
        </section>}
        {activeView === "learning" && <>
        <MenuGroup title="예시와 읽을거리">
          <MenuAction category="journal" icon={BookOpen} label="일지 예시 보기" onClick={onOpenMinji} />
          <MenuAction category="training" icon={CircleHelp} label="훈련 용어집·도움말" onClick={onOpenGuide} />
          {onOpenContent && <MenuAction category="training" icon={BookOpen} label="훈련법 읽기" onClick={onOpenContent} />}
        </MenuGroup>
        {(onOpenRewards || onOpenMinigame) && <MenuGroup title="꾸미기·게임">
          {onOpenRewards && <MenuAction category="journal" icon={NotebookPen} label="일지 꾸미기" onClick={onOpenRewards} />}
          {onOpenMinigame && <MenuAction icon={Gamepad2} label="게임 라운지" illustration="running-game-announcement" onClick={onOpenMinigame} />}
        </MenuGroup>}
        </>}
        {activeView === "account" && <>
        <MenuGroup title="계정과 앱">
          {onOpenAccount && <MenuAction icon={CircleUserRound} label="계정 저장 상태 확인" onClick={onOpenAccount} />}
          <InstallShortcutMenuEntry />
        </MenuGroup>
        <DataSafetyNotice onOpenAccount={onOpenAccount} />
        </>}
        {activeView === "backup" && <>
        <MenuGroup title="파일 백업과 복원">
          <SafeJournalExport onOpenRestore={onOpenRestore} />
        </MenuGroup>
        <details className="more-screen__trash">
          <summary><Trash2 size={19} aria-hidden="true" /><span>휴지통 · {trashCount}개</span></summary>
          {trashCount === 0 ? <p>지운 일지가 없어요.</p> : <TrashBin onChanged={() => setTrashCount(loadTrash().length)} />}
        </details>
        </>}
        {activeView === "about" && <>
        <MenuGroup title="문의와 기기">
        {onOpenFeedback === undefined ? (
          <MenuAction icon={MessageSquareText} label="문의 게시판" detail={feedbackAvailable ? undefined : "준비 중"} href="?feedback=1" />
        ) : (
          <MenuAction icon={MessageSquareText} label="문의 게시판" detail={feedbackAvailable ? undefined : "준비 중"} onClick={onOpenFeedback} />
        )}
        <MenuAction icon={Watch} label="기기 연동 상태" detail="Garmin · COROS" href="./support.html" target="_blank" />
        </MenuGroup>
        <MenuGroup title="개인정보와 이용 안내">
          <MenuAction icon={ShieldCheck} label="개인정보처리방침" href="./legal/privacy.html" target="_blank" />
          <MenuAction icon={ScrollText} label="이용약관" href="./legal/terms.html" target="_blank" />
        </MenuGroup>
        <MenuGroup title="출처와 라이선스">
          <MenuAction category="journal" icon={Sticker} label="스티커·오픈소스 출처" href="./legal/open-source.html" target="_blank" />
          <MenuAction icon={LibraryBig} label="오픈소스 소프트웨어 고지" href="./legal/third-party-notices.html" target="_blank" />
        </MenuGroup>
        </>}
      </div>

    </div>
  )
}

function MenuGroup({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  const titleId = React.useId()
  return <section className="more-screen__group" aria-labelledby={titleId}>
    <AppHeading as="h2" variant="section" className="more-screen__group-label" id={titleId}>{title}</AppHeading>
    {children}
  </section>
}
