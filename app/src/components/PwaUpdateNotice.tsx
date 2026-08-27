import React from "react"
import { RefreshCw } from "lucide-react"
import {
  activateWaitingAppUpdate,
  subscribeToAppUpdate,
} from "../domain/pwa-update"

export function PwaUpdateNotice({ raised = false }: { readonly raised?: boolean }) {
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => subscribeToAppUpdate(setReady), [])
  if (!ready) return null

  return (
    <div className="pwa-update-notice" data-raised={raised ? "true" : "false"} role="status">
      <span>새 버전이 준비됐어요. 작성 중인 내용이 없다면 바로 바꿀 수 있어요.</span>
      <button type="button" onClick={activateWaitingAppUpdate}>
        <RefreshCw aria-hidden="true" size={16} />
        새 버전 열기
      </button>
    </div>
  )
}
