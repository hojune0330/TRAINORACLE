import { ChevronRight, Flag, Watch } from "lucide-react"
import { InfoDisclosure } from "./InfoDisclosure"
import { AppHeading } from "./AppHeading"
import "./record-start.css"

export function RecordStartActions({ onImport, onRecords }: {
  readonly onImport?: (() => void) | undefined
  readonly onRecords?: (() => void) | undefined
}) {
  if (!onImport && !onRecords) return null
  return <section className="record-start" aria-label="이미 있는 기록으로 시작하기">
    <AppHeading as="h2" variant="section">이미 있는 기록으로 시작해요</AppHeading>
    <nav aria-label="기록 가져오기 또는 최고기록 입력">
      {onImport && <button type="button" onClick={onImport}><Watch size={18} aria-hidden="true" /><span><strong>운동 파일 가져오기</strong><small>가민·코로스 등의 운동 기록</small></span><ChevronRight size={18} aria-hidden="true" /></button>}
      {onRecords && <button type="button" onClick={onRecords}><Flag size={18} aria-hidden="true" /><span><strong>최고기록 남기기</strong><small>종목과 시간으로 페이스 확인</small></span><ChevronRight size={18} aria-hidden="true" /></button>}
    </nav>
    <InfoDisclosure title="워치·건강앱 기록은 어떻게 가져오나요?">
      <p>운동을 TCX·GPX 또는 지원하는 CSV·JSON으로 내보낸 뒤 파일을 골라요. 거리·시간을 먼저 확인하고, 원하는 기록만 저장해요.</p>
      <p>가민 등의 계정을 연결해 자동으로 받는 기능은 준비 중이에요. 애플 건강·삼성 헬스의 전체 백업 ZIP·XML을 그대로 받는 기능은 아직 없어요.</p>
      <p>가져온 수치는 출처와 확인 상태에 따라 분석 범위가 달라요. 가져오기만으로 최고기록이나 훈련 목표를 바꾸지 않아요.</p>
    </InfoDisclosure>
  </section>
}
