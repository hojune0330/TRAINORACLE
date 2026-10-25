import React from "react"
import { Check, Download, Share2, X } from "lucide-react"
import { DEFAULT_JOURNAL_SHARE_STYLE, journalShareText, renderJournalSharePng, type JournalShareCard, type JournalShareStyle } from "../domain/journal-share-card"
import { MEMO_PAPERS, downloadMemo } from "../domain/workout-memo-export"
import { COMPANION_ANIMALS, companionStampUrl } from "../domain/training-companions"
import { localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import "./journal-share-tool.css"

export function JournalSharePreview({ card }: { readonly card: JournalShareCard }) {
  return <div className="journal-share-preview" aria-label="공유 카드 예시">
    <span>예시 · 가상 기록</span>
    <strong>{card.title}</strong>
    <dl>{card.metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>
    <footer><span>TRAINORACLE</span><img src={companionStampUrl({ animal: "otter", pose: "run" })} alt="" width={80} height={80} /></footer>
  </div>
}

export function JournalShareTool({ card, label = "공유 카드 만들기", showPreview = false, primaryAction }: { readonly card: JournalShareCard; readonly label?: string; readonly showPreview?: boolean; readonly primaryAction?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const trigger = React.useRef<HTMLButtonElement>(null)
  const panelId = React.useId()
  const signature = JSON.stringify(card)
  return <section className="journal-share-tool" aria-label="일지 공유 카드">
    {!open && showPreview && <JournalSharePreview card={card} />}
    {!open && primaryAction}
    <button type="button" ref={trigger} className="journal-share-tool__entry" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}><Share2 aria-hidden="true" size={18} />{label}</button>
    {open && <JournalShareEditor key={signature} card={card} panelId={panelId} onClose={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }) }} />}
  </section>
}

function JournalShareEditor({ card, panelId, onClose }: { readonly card: JournalShareCard; readonly panelId: string; readonly onClose: () => void }) {
  const [style, setStyle] = React.useState<JournalShareStyle>(DEFAULT_JOURNAL_SHARE_STYLE)
  const [preview, setPreview] = React.useState<{ key: string; url: string; blob: Blob } | null>(null)
  const [message, setMessage] = React.useState("")
  const [failed, setFailed] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  const [invalidated, setInvalidated] = React.useState(false)
  const lock = React.useRef(false), epoch = React.useRef(0)
  const scope = React.useRef(localJournalScopeGeneration())
  const key = JSON.stringify(style)
  const ready = preview?.key === key ? preview : null
  React.useEffect(() => {
    const revision = ++epoch.current
    let url: string | null = null
    setFailed(false); setMessage(""); setPreview(null); setBusy(false); lock.current = false
    void renderJournalSharePng(card, style).then(blob => {
      if (revision !== epoch.current || scope.current !== localJournalScopeGeneration()) return
      url = URL.createObjectURL(blob)
      setPreview({ key, url, blob })
    }).catch(() => { if (revision === epoch.current) setFailed(true) })
    return () => { epoch.current++; if (url) URL.revokeObjectURL(url) }
  // The parent remounts on every projected-data change; key captures all export choices.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry])
  React.useEffect(() => onLocalJournalScopeChange(() => { epoch.current++; setPreview(null); setInvalidated(true) }), [])
  if (invalidated) return <p role="status">계정이 바뀌었어요. 현재 일지를 다시 열어 주세요.</p>

  const exportImage = async (share: boolean) => {
    if (!ready || lock.current || scope.current !== localJournalScopeGeneration()) return
    lock.current = true; setBusy(true); setMessage("")
    const revision = epoch.current
    try {
      const file = new File([ready.blob], `trainoracle-${card.example ? "example" : "journal"}.png`, { type: "image/png" })
      if (share && navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: card.example ? "TrainOracle 일지 예시" : "나의 운동 기록" })
        if (revision === epoch.current) setMessage("공유창에 전달했어요. 게시 여부는 선택한 앱에서 확인해 주세요.")
      } else {
        downloadMemo(ready.blob, file.name)
        setMessage(share ? "파일 공유를 지원하지 않아 이미지를 내려받아요. 원하는 앱에서 올려 주세요." : "이미지 다운로드를 시작했어요. 인스타 등 원하는 앱에서 올려 주세요.")
      }
    } catch (error) {
      const canceled = typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
      if (revision === epoch.current && !canceled) setMessage("공유하지 못했어요. 이미지 저장으로 다시 시도해 주세요.")
    } finally { if (revision === epoch.current) { lock.current = false; setBusy(false) } }
  }
  return <div id={panelId} className="journal-share-editor" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose() } }}>
    <header><h3>꾸미고, 한 장으로 남기기</h3><button type="button" onClick={onClose} aria-label="공유 카드 닫기" title="닫기"><X size={18} aria-hidden="true" /></button></header>
    <p>숫자만 담은 공유용 카드예요. 메모·통증·수면·글 스티커는 담지 않아요.</p>
    <div className="journal-share-editor__choices">
      <div className="app-choice-group" role="group" aria-label="공유 이미지 모양">
        {([['portrait', '세로'], ['square', '정사각']] as const).map(([format, name]) => <button type="button" className="app-choice-control" aria-pressed={style.format === format} disabled={busy} key={format} onClick={() => setStyle(value => ({ ...value, format }))}>{name}</button>)}
      </div>
      <div role="group" aria-label="카드 종이색" className="journal-share-editor__swatches">
        {MEMO_PAPERS.map(paper => <button type="button" key={paper.id} disabled={busy} title={paper.label} aria-label={paper.label} aria-pressed={style.paper === paper.id} style={{ background: `var(${paper.token})` }} onClick={() => setStyle(value => ({ ...value, paper: paper.id }))}>{style.paper === paper.id && <Check size={18} aria-hidden="true" />}</button>)}
      </div>
      <label>그림<select aria-label="공유 카드 그림" disabled={busy} value={style.stamp?.animal ?? "none"} onChange={event => { const animal = COMPANION_ANIMALS.find(item => item.id === event.target.value); setStyle(value => ({ ...value, stamp: animal ? { animal: animal.id, pose: "run" } : null })) }}><option value="none">그림 없음</option>{COMPANION_ANIMALS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="journal-share-editor__date"><input type="checkbox" checked={style.showDate} disabled={busy} onChange={event => setStyle(value => ({ ...value, showDate: event.target.checked }))} />날짜 넣기</label>
    </div>
    {ready ? <img className="journal-share-editor__image" src={ready.url} alt={journalShareText(card, style)} /> : <div className="journal-share-editor__pending" role="status">{failed ? "이미지를 만들지 못했어요. 그림 없이 다시 시도할 수 있어요." : "이미지를 만들고 있어요."}{failed && <button type="button" onClick={() => { setStyle(value => ({ ...value, stamp: null })); setRetry(value => value + 1) }}>다시 만들기</button>}</div>}
    <div className="journal-share-editor__actions"><button type="button" disabled={!ready || busy} onClick={() => { void exportImage(false) }}><Download size={18} aria-hidden="true" />이미지 저장</button><button type="button" disabled={!ready || busy} onClick={() => { void exportImage(true) }}><Share2 size={18} aria-hidden="true" />공유</button></div>
    {message && <p role="status">{message}</p>}
  </div>
}
