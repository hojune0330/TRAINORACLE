import { useState } from "react"
import { FileUp, Watch, Heart, Activity } from "lucide-react"
import { AppHeading } from "../components/AppHeading"
import { MenuAction } from "../components/MenuAction"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { GarminConnectionPanel, type OpenGarminJournalRecord } from "../components/GarminConnectionPanel"
import "./device-connections.css"

/** Connection and receipt come only from the authenticated service, never a build flag. */
export function DeviceConnections({ onOpenImport, ownerId = null, onOpenAccount, onOpenJournalRecord }: {
  readonly onOpenImport?: () => void
  readonly ownerId?: string | null
  readonly onOpenAccount?: () => void
  readonly onOpenJournalRecord?: OpenGarminJournalRecord
}) {
  const [subview, setSubview] = useState(false)
  return <div className="device-connections">
    <section aria-labelledby="connection-auto-title">
      <div hidden={subview}><AppHeading as="h2" variant="section" id="connection-auto-title">기기 및 건강 데이터</AppHeading></div>
      <GarminConnectionPanel onSubviewChange={setSubview} ownerId={ownerId} onOpenAccount={onOpenAccount} onOpenJournalRecord={onOpenJournalRecord} />
      <div hidden={subview}>
      <ul className="device-connections__providers" aria-label="다른 기기 연결 제공 여부">
        <li><Watch aria-hidden="true" size={24} /><strong>COROS</strong><span>자동 연결 준비 중</span></li>
        <li><Heart aria-hidden="true" size={24} /><strong>Apple 건강</strong><span>iOS 앱 연결 준비 중</span></li>
        <li><Activity aria-hidden="true" size={24} /><strong>Health Connect</strong><span>Android 앱 연결 준비 중</span></li>
      </ul>
      <InfoDisclosure title="파일 가져오기와 자동 연결은 달라요">
        <p>파일을 저장해도 워치 계정이 연결되지는 않아요. 새 운동을 가져오려면 파일을 다시 골라 주세요.</p>
        <p>이 표시는 현재 앱의 기능 범위예요. 업체의 심사 결과나 내 기기의 권한 상태를 확인한 결과는 아니에요.</p>
      </InfoDisclosure>
      </div>
    </section>
    <section hidden={subview} aria-labelledby="connection-file-title">
      <AppHeading as="h2" variant="section" id="connection-file-title">파일로 가져오기</AppHeading>
      <p>워치 앱에서 내보낸 파일을 고르고, 날짜와 수치를 확인한 다음 저장해요.</p>
      {onOpenImport && <MenuAction category="record" icon={FileUp} label="워치 파일 가져오기" onClick={onOpenImport} />}
      <p className="device-connections__detail">가져온 파일의 원본은 그대로예요. 저장할 운동은 다음 화면에서 고를 수 있어요.</p>
    </section>
  </div>
}
