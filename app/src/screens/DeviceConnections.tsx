import { useCallback, useState } from "react"
import { FileUp, Watch, Heart, Activity } from "lucide-react"
import { AppHeading } from "../components/AppHeading"
import { MenuAction } from "../components/MenuAction"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { GarminConnectionPanel, type OpenGarminJournalRecord, type StorageConnectionReadiness } from "../components/GarminConnectionPanel"
import "./device-connections.css"

/** Connection and receipt come only from the authenticated service, never a build flag. */
export function DeviceConnections({ onOpenImport, ownerId = null, onOpenAccount, onOpenJournalRecord, onSubviewChange, showFileEntry = true, inlineSetup = false, onOpenStorageSettings, storageReadiness }: {
  readonly onOpenImport?: () => void
  readonly ownerId?: string | null
  readonly onOpenAccount?: () => void
  readonly onOpenJournalRecord?: OpenGarminJournalRecord
  readonly onSubviewChange?: (active: boolean) => void
  readonly showFileEntry?: boolean
  readonly inlineSetup?: boolean
  readonly storageReadiness?: StorageConnectionReadiness
  readonly onOpenStorageSettings?: () => void
}) {
  const [subview, setSubview] = useState(false)
  const changeSubview = useCallback((active: boolean) => { setSubview(active); onSubviewChange?.(active) }, [onSubviewChange])
  return <div className="device-connections">
    <section aria-labelledby="connection-auto-title">
      <div hidden={subview}>
        <AppHeading as="h2" variant="section" id="connection-auto-title">{inlineSetup ? "내 워치와 운동 기록" : "워치에서 자동으로 가져오기"}</AppHeading>
        {!inlineSetup && <p>한 번 연결하면 새 운동을 여기에서 확인할 수 있어요.</p>}
      </div>
      <GarminConnectionPanel onSubviewChange={changeSubview} ownerId={ownerId} onOpenAccount={onOpenAccount} onOpenJournalRecord={onOpenJournalRecord} inlineSetup={inlineSetup} onOpenStorageSettings={onOpenStorageSettings} storageReadiness={storageReadiness} />
      <div hidden={subview}>
      <InfoDisclosure title="COROS·애플·삼성은 어떻게 연결하나요?">
      <p>자동 연결은 아직 준비 중이에요. 개별 운동 파일이 있으면 파일 가져오기를 이용해 주세요.</p>
      <ul className="device-connections__providers" aria-label="다른 기기 연결 제공 여부">
        <li><Watch aria-hidden="true" size={24} /><strong>COROS</strong><span>자동 연결 준비 중</span></li>
        <li><Heart aria-hidden="true" size={24} /><strong>Apple 건강</strong><span>iOS 앱 연결 준비 중</span></li>
        <li><Activity aria-hidden="true" size={24} /><strong>삼성 헬스 · Health Connect</strong><span>Android 앱 연결 준비 중</span></li>
      </ul>
      <p>건강앱 전체 백업 파일은 아직 읽지 못해요. 파일 가져오기에서 지원 형식과 준비 방법을 확인할 수 있어요.</p>
      </InfoDisclosure>
      <InfoDisclosure title="어떤 데이터를 가져올 수 있나요?">
        <dl>
          <dt>Garmin 운동</dt><dd>연결한 뒤 전달된 운동의 거리·원본 시간을 보여줘요. 연결 전 기록은 파일로 가져올 수 있어요.</dd>
          <dt>운동 중 심박·경로·구간</dt><dd>해당 운동에서 실제로 받은 세부 자료만 보여줘요. 없는 값은 0으로 채우지 않아요.</dd>
          <dt>수면·하루 심박·HRV</dt><dd>자동 수집 준비 중이에요. 현재 홈의 수면·안정시 심박은 내 일지에 적은 값이에요.</dd>
          <dt>제조사 운동부하·회복 점수</dt><dd>자동 수집 준비 중이에요. 다른 회사의 점수를 합쳐 하나의 점수로 표시하지 않아요.</dd>
        </dl>
      </InfoDisclosure>
      </div>
    </section>
    {showFileEntry && <section hidden={subview} aria-labelledby="connection-file-title">
      <AppHeading as="h2" variant="section" id="connection-file-title">이전 기록은 파일로 가져오기</AppHeading>
      <p>내보낸 파일이 있거나 아직 자동연동을 지원하지 않는 기기라면 파일을 골라 주세요.</p>
      {onOpenImport && <MenuAction category="record" icon={FileUp} label="워치 파일 가져오기" onClick={onOpenImport} />}
      <p className="device-connections__detail">가져온 파일의 원본은 그대로예요. 저장할 운동은 다음 화면에서 고를 수 있어요.</p>
    </section>}
  </div>
}
