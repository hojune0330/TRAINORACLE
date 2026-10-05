import React from "react"
import { exportAccountDataRights, rightsCollections } from "../../domain/account/account-data-rights"
import type { RightsCollection } from "../../domain/account/account-data-rights"
import { secondaryBtn } from "./styles"

export function AccountDataRightsPanel({ userId, exportData = exportAccountDataRights }: {
  readonly userId: string; readonly exportData?: typeof exportAccountDataRights
}) {
  const [collection, setCollection] = React.useState<RightsCollection>("journal")
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState("")
  const owner = React.useRef<string | null>(userId)
  owner.current = userId
  React.useEffect(() => () => { owner.current = null }, [])
  async function download() {
    if (busy) return
    setBusy(true); setNotice("")
    const result = await exportData(userId, collection, () => owner.current === userId)
    if (owner.current !== userId) return
    setBusy(false)
    if (!result.ok) { setNotice(result.message); return }
    const url = URL.createObjectURL(new Blob([result.text], { type: "application/json;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url; anchor.download = `trainoracle-${collection}-${new Date().toISOString().slice(0,10)}.json`
    anchor.click(); URL.revokeObjectURL(url)
    setNotice("선택한 자료의 열람 사본을 내려받았어요. 건강정보와 글이 포함될 수 있으니 안전한 곳에 보관해 주세요.")
  }
  return <section className="account-panel" aria-label="내 자료 열람">
    <h2 style={{ margin: 0 }}>내 자료 내려받기</h2>
    <p className="account-panel__body">온라인 보관 동의를 철회해도 본인 자료를 직접 내려받을 수 있어요. 동의를 다시 켜거나 앱으로 자동 복구하지 않아요. 삭제는 계정 삭제에서 요청해 주세요.</p>
    <label>내려받을 자료 <select value={collection} disabled={busy} style={{ minHeight: 44 }}
      onChange={event => setCollection(event.target.value as RightsCollection)}>
      {Object.entries(rightsCollections).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void download()}>
      {busy ? "자료 확인 중…" : "선택한 자료 내려받기"}
    </button>
    {notice && <p role="status">{notice}</p>}
  </section>
}
