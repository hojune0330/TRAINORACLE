import React from "react"
import { ArrowLeft, BookOpen, Calculator, CircleHelp, Flag, Gamepad2, MessageSquareText, Newspaper, ScrollText, ShieldCheck, Sticker, Trash2, UserRound, Watch } from "lucide-react"
import { DataSafetyNotice } from "../components/DataSafetyNotice"
import { feedbackConfig } from "../domain/feedback/feedback-config"
import { SafeJournalExport } from "./home/DeviceJournal"
import { InstallShortcutMenuEntry } from "../components/InstallShortcut"
import { TrashBin } from "./home/TrashBin"
import { loadTrash } from "../domain/journal-trash"
import "../styles/home-menu.css"

export type MoreProps = {
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
}

export function More({
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
}: MoreProps) {
  const [trashCount, setTrashCount] = React.useState(() => loadTrash().length)
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
        {(onOpenPaceCalculator || onOpenImport || onOpenRecords) && <h2 className="more-screen__group-label">훈련 도구</h2>}
        {onOpenPaceCalculator && <UtilityRow icon={Calculator} label="페이스 계산" onClick={onOpenPaceCalculator} />}
        {onOpenRecords && <UtilityRow icon={Flag} label="경기 기록 추가·수정" onClick={onOpenRecords} />}
        {onOpenImport && <UtilityRow icon={Watch} label="워치 파일 가져오기" onClick={onOpenImport} />}
        {(onOpenRunningProfile || onOpenRecordReading || onOpenOracleLibrary) && <h2 className="more-screen__group-label">오라클</h2>}
        {onOpenRunningProfile && <UtilityRow icon={UserRound} label="나의 러닝 프로필" detail="취향 점수 · 친구와 비교" onClick={onOpenRunningProfile} />}
        {onOpenRecordReading && <UtilityRow icon={Calculator} label="최고기록으로 풀이하기" detail="저장 없이 내 기록·친구 기록 비교" onClick={onOpenRecordReading} />}
        {onOpenOracleLibrary && <UtilityRow icon={BookOpen} label="오라클 읽을거리" onClick={onOpenOracleLibrary} />}
        <h2 className="more-screen__group-label">배우기·꾸미기</h2>
        <UtilityRow icon={BookOpen} label="민지의 예시 일지" onClick={onOpenMinji} />
        <UtilityRow icon={CircleHelp} label="훈련 용어집·도움말" onClick={onOpenGuide} />
        {onOpenContent !== undefined && <UtilityRow icon={Newspaper} label="훈련법 읽기" onClick={onOpenContent} />}
        {onOpenRewards !== undefined && <UtilityRow icon={Sticker} label="일지 꾸미기·포인트" onClick={onOpenRewards} />}
        {onOpenMinigame && <UtilityRow icon={Gamepad2} label="미니게임" detail="러닝 투어 · 서울에서 런던까지" onClick={onOpenMinigame} />}
        <h2 className="more-screen__group-label">계정·기록 관리</h2>
        <InstallShortcutMenuEntry />
        <DataSafetyNotice onOpenAccount={onOpenAccount} />
        <SafeJournalExport onOpenRestore={onOpenRestore} />
        <details className="more-screen__trash">
          <summary><Trash2 size={19} aria-hidden="true" /><span>휴지통 · {trashCount}개</span></summary>
          {trashCount === 0 ? <p>지운 일지가 없어요.</p> : <TrashBin onChanged={() => setTrashCount(loadTrash().length)} />}
        </details>
        <h2 className="more-screen__group-label">도움말</h2>
        {onOpenFeedback === undefined ? (
          <a className="more-screen__row" href="?feedback=1">
            <MessageSquareText aria-hidden="true" size={19} />
            <span><strong>문의 게시판</strong><small>{feedbackAvailable ? "불편한 점을 일지 내용 없이 남겨요" : "지금은 준비 중이에요. 열리면 앱 안에서 알려드려요"}</small></span>
          </a>
        ) : (
          <UtilityRow icon={MessageSquareText} label="문의 게시판" detail={feedbackAvailable ? "불편한 점을 일지 내용 없이 남겨요" : "지금은 준비 중이에요. 열리면 앱 안에서 알려드려요"} onClick={onOpenFeedback} />
        )}
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
        <a className="more-screen__row" href="./legal/third-party-notices.html" target="_blank" rel="noreferrer">
          <ScrollText aria-hidden="true" size={19} />
          <span><strong>오픈소스 소프트웨어 고지</strong><small>앱에 포함된 소프트웨어의 라이선스 전문을 확인해요</small></span>
        </a>
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
  return (
    <button className="more-screen__row" type="button" onClick={onClick} aria-label={label}>
      <Icon aria-hidden="true" size={19} />
      <span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>
    </button>
  )
}
