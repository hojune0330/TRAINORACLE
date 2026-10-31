import { FileUp } from "lucide-react"
import { AppHeading } from "../components/AppHeading"
import { MenuAction } from "../components/MenuAction"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { RecordStateList } from "../components/RecordUI"
import "./device-connections.css"

/** This build has no wearable OAuth consumer. Do not infer personal connection or program approval. */
export function DeviceConnections({ onOpenImport }: { readonly onOpenImport?: () => void }) {
  return <div className="device-connections">
    <section aria-labelledby="connection-file-title">
      <AppHeading as="h2" variant="section" id="connection-file-title">파일로 먼저 가져오세요</AppHeading>
      <p>워치 앱에서 내보낸 파일을 고르고, 날짜와 수치를 확인한 다음 저장해요.</p>
      {onOpenImport && <MenuAction category="record" icon={FileUp} label="워치 파일 가져오기" onClick={onOpenImport} />}
      <p className="device-connections__detail">가져온 파일의 원본은 그대로예요. 저장할 운동은 다음 화면에서 고를 수 있어요.</p>
    </section>
    <section aria-labelledby="connection-auto-title">
      <AppHeading as="h2" variant="section" id="connection-auto-title">자동으로 가져오기</AppHeading>
      <p>이 앱 버전에서는 기기 계정 연결을 제공하지 않아요.</p>
      <RecordStateList label="자동 연결 제공 여부" items={["Garmin", "COROS", "Apple 건강 · Health Connect"].map(name => ({ id: name, label: name, state: { phase: "connection", status: "unavailable" } }))} />
      <InfoDisclosure title="파일 가져오기와 자동 연결은 달라요">
        <p>파일을 저장해도 워치 계정이 연결되지는 않아요. 새 운동을 가져오려면 파일을 다시 골라 주세요.</p>
        <p>이 표시는 현재 앱의 기능 범위예요. 업체의 심사 결과나 내 기기의 권한 상태를 확인한 결과는 아니에요.</p>
      </InfoDisclosure>
    </section>
  </div>
}
