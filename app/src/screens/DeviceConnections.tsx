import { useCallback, useState } from "react"
import { FileUp, Watch, Heart, Activity } from "lucide-react"
import { AppHeading } from "../components/AppHeading"
import { MenuAction } from "../components/MenuAction"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { GarminConnectionPanel, type OpenGarminJournalRecord } from "../components/GarminConnectionPanel"
import "./device-connections.css"

/** Connection and receipt come only from the authenticated service, never a build flag. */
export function DeviceConnections({ onOpenImport, ownerId = null, onOpenAccount, onOpenJournalRecord, onSubviewChange }: {
  readonly onOpenImport?: () => void
  readonly ownerId?: string | null
  readonly onOpenAccount?: () => void
  readonly onOpenJournalRecord?: OpenGarminJournalRecord
  readonly onSubviewChange?: (active: boolean) => void
}) {
  const [subview, setSubview] = useState(false)
  const changeSubview = useCallback((active: boolean) => { setSubview(active); onSubviewChange?.(active) }, [onSubviewChange])
  return <div className="device-connections">
    <section aria-labelledby="connection-auto-title">
      <div hidden={subview}>
        <AppHeading as="h2" variant="section" id="connection-auto-title">한 번 연결하고, 운동 기록은 자동으로</AppHeading>
        <p>연결한 워치의 새 운동을 받아요. 받은 기록과 저장 상태를 여기에서 확인할 수 있어요.</p>
      </div>
      <GarminConnectionPanel onSubviewChange={changeSubview} ownerId={ownerId} onOpenAccount={onOpenAccount} onOpenJournalRecord={onOpenJournalRecord} />
      <div hidden={subview}>
      <ul className="device-connections__providers" aria-label="다른 기기 연결 제공 여부">
        <li><Watch aria-hidden="true" size={24} /><strong>COROS</strong><span>자동 연결 준비 중</span></li>
        <li><Heart aria-hidden="true" size={24} /><strong>Apple 건강</strong><span>iOS 앱 연결 준비 중</span></li>
        <li><Activity aria-hidden="true" size={24} /><strong>Health Connect</strong><span>Android 앱 연결 준비 중</span></li>
      </ul>
      <InfoDisclosure title="다른 워치의 기록도 가져올 수 있나요?">
        <p>자동연동 준비 중인 기기는 내보낸 파일로 기록을 가져올 수 있어요. 파일 가져오기는 계정 연결과 별개예요.</p>
      </InfoDisclosure>
      </div>
    </section>
    <section hidden={subview} aria-labelledby="connection-file-title">
      <AppHeading as="h2" variant="section" id="connection-file-title">이전 기록은 파일로 가져오기</AppHeading>
      <p>내보낸 파일이 있거나 아직 자동연동을 지원하지 않는 기기라면 파일을 골라 주세요.</p>
      {onOpenImport && <MenuAction category="record" icon={FileUp} label="워치 파일 가져오기" onClick={onOpenImport} />}
      <p className="device-connections__detail">가져온 파일의 원본은 그대로예요. 저장할 운동은 다음 화면에서 고를 수 있어요.</p>
    </section>
  </div>
}
