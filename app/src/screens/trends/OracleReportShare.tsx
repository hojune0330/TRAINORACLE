import React from "react"
import type { OracleReport } from "../../domain/oracle-report"
import { oracleShareMoments, projectOracleShare, type OracleShareTemplate } from "../../domain/oracle-report-share"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { registerBrowserBackLayer } from "../../navigation/browserNavigation"
import { renderOracleSharePng } from "./oracle-report-share-render"
import "./oracle-report-share.css"

export function OracleReportShare({ report, accountScopeKey, onClose }: { readonly report: OracleReport; readonly accountScopeKey?: string | undefined; readonly onClose: () => void }) {
  const [template, setTemplate] = React.useState<OracleShareTemplate>("summary")
  const [momentSelection, setMomentSelection] = React.useState<{ index: number; revision: string } | null>(null)
  const [png, setPng] = React.useState<{ blob: Blob; url: string; key: string } | null>(null)
  const [message, setMessage] = React.useState("이미지를 준비하고 있어요.")
  const [busy, setBusy] = React.useState(false)
  const dialog = React.useRef<HTMLDialogElement>(null), lock = React.useRef(false), epoch = React.useRef(0)
  const closeRef = React.useRef(onClose); closeRef.current = onClose
  const id = React.useId()
  // Internal revision binds a deliberate selection to the accepted source set.
  // It is never passed to the raster renderer or exported as metadata/text.
  const inputRevision = JSON.stringify([accountScopeKey, report.source, report.period,
    report.evidence.map(item => [item.id, item.date, item.sourceRef, item.metrics.DISTANCE_KM, item.distanceIncluded, item.durationMin, item.methodLabel])])
  const momentIndex = momentSelection?.revision === inputRevision ? momentSelection.index : undefined
  const projected = projectOracleShare(report, template, momentIndex)
  const semanticKey = JSON.stringify(projected)
  const snapshot = React.useMemo(() => projected, [semanticKey])
  const key = JSON.stringify([inputRevision, snapshot])
  const keyRef = React.useRef(key); keyRef.current = key
  const moments = oracleShareMoments(report)
  React.useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.current?.showModal()
    const back = registerBrowserBackLayer({ id: `oracle-share-${id}`, canClose: () => true, onClose: () => closeRef.current() })
    return () => { back.dispose(); dialog.current?.close(); opener?.focus({ preventScroll: true }) }
  }, [id])
  React.useEffect(() => onLocalJournalScopeChange(() => { epoch.current++; setPng(null); closeRef.current() }), [])
  React.useEffect(() => {
    const revision = ++epoch.current; let url: string | undefined
    setPng(null); setBusy(false); lock.current = false
    if (!snapshot) { setMessage(template === "moment" ? "운동을 하나 선택해 주세요." : "공유할 요약을 확인하지 못했어요. 리포트를 다시 열어 주세요."); return }
    setMessage("이미지를 준비하고 있어요.")
    void renderOracleSharePng(snapshot).then(blob => {
      if (epoch.current !== revision) return
      url = URL.createObjectURL(blob); setPng({ blob, url, key }); setMessage("미리보기를 확인한 뒤 저장하거나 공유해 주세요.")
    }).catch(() => { if (epoch.current === revision) setMessage("이미지를 만들지 못했어요. 다른 양식을 선택하거나 다시 열어 주세요.") })
    return () => { epoch.current++; if (url) URL.revokeObjectURL(url) }
  }, [snapshot, key, template])
  async function act(kind: "save" | "share") {
    if (!png || png.key !== keyRef.current || lock.current) return
    lock.current = true; setBusy(true)
    const revision = epoch.current
    try {
      const file = new File([png.blob], "trainoracle-report.png", { type: "image/png" })
      if (kind === "share" && navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: "훈련 리포트" })
        if (epoch.current === revision) setMessage("기기 공유창을 닫았어요. 상대방의 수신 여부는 확인할 수 없어요.")
      } else {
        const anchor = document.createElement("a"); anchor.href = png.url; anchor.download = file.name; anchor.click()
        if (epoch.current === revision) setMessage(kind === "share" ? "이 브라우저에서는 파일 공유를 지원하지 않아 이미지 다운로드를 시작했어요." : "이미지 다운로드를 시작했어요.")
      }
    } catch (error) {
      if (epoch.current === revision) setMessage(typeof error === "object" && error !== null && "name" in error && error.name === "AbortError" ? "공유를 취소했어요." : "이미지를 저장하거나 공유하지 못했어요. 다시 시도해 주세요.")
    } finally { if (epoch.current === revision) { lock.current = false; setBusy(false) } }
  }
  return <dialog ref={dialog} className="oracle-report-share" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); onClose() }}>
    <header><h2 id={`${id}-title`}>한 장으로 남기기</h2><button type="button" onClick={onClose}>닫기</button></header>
    <p>기기에서 이미지를 만들어요. 이름·위치·메모·몸 기록은 포함하지 않아요.</p>
    <div role="group" aria-label="이미지 양식" className="app-choice-group">{([['summary', '기간 요약'], ['moment', '기억할 운동']] as const).map(([value, label]) => <button type="button" key={value} className="app-choice-control" aria-pressed={template === value} onClick={() => setTemplate(value)}>{label}</button>)}</div>
    {template === "moment" && <label>남길 운동<select value={momentIndex ?? ""} onChange={event => setMomentSelection(event.target.value === "" ? null : { index: Number(event.target.value), revision: inputRevision })}><option value="">운동 선택</option>{moments.map(item => <option key={item.index} value={item.index}>{item.date} · {item.km === null ? item.method ?? `${item.duration}분` : `${item.km.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} km`}</option>)}</select>{moments.length === 0 && <span>이 기간에 남길 수 있는 수행 기록이 없어요.</span>}</label>}
    {png && png.key === key && <img src={png.url} width={1080} height={1350} alt={`${template === "summary" ? "기간 요약" : "기억할 운동"} 이미지 미리보기. ${snapshot?.headline ?? ""}`} />}
    <p role="status" aria-live="polite">{message}</p>
    <footer><button type="button" disabled={!png || png.key !== key || busy} onClick={() => void act("save")}>이미지 저장</button><button type="button" disabled={!png || png.key !== key || busy} onClick={() => void act("share")}>기기 공유</button></footer>
  </dialog>
}
