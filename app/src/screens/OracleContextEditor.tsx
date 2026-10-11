import React from "react"
import { ArrowLeft, Check, ChevronRight, X } from "lucide-react"
import { useReaderDialog } from "../hooks/useReaderDialog"
import { ORACLE_CONTEXT_QUESTIONS, oracleProfileContextSchema, type OracleProfileContext } from "../domain/oracle-profile-context"
import { OracleConditionsFields, type OracleConditionsHandle } from "./OracleConditionsFields"
import type { AthleteRecord } from "../domain/athlete-records"

export function OracleContextEditor({ initial, onSave, onClose, onDraft, records = null }: {
  initial?: OracleProfileContext; onSave: (context: OracleProfileContext) => Promise<boolean>; onClose: () => void; onDraft: (context: OracleProfileContext) => void; records?: readonly AthleteRecord[] | null
}) {
  const [draft, setDraft] = React.useState<OracleProfileContext>(() => initial ?? { version: "ORACLE_CONTEXT_V1", answeredAt: new Date().toISOString(), answers: {}, conditions: {} })
  const [index, setIndex] = React.useState<number | null>(null)
  const [group, setGroup] = React.useState(0)
  const [conditionsView, setConditionsView] = React.useState<"race" | "event" | "meeting" | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const ref = React.useRef<HTMLDialogElement>(null)
  const heading = React.useRef<HTMLHeadingElement>(null)
  const conditions = React.useRef<OracleConditionsHandle>(null)
  const dirty = React.useRef(false)
  const finishConditions = () => conditions.current?.finish() ?? true
  const closeReader = useReaderDialog(ref, () => {
    if (finishConditions()) onClose()
    // Invalid unfinished inputs stay visible, including when native Back was used.
    else window.history.forward()
  })
  const close = () => { if (!busy && finishConditions()) closeReader() }
  const draftListener = React.useRef(onDraft)
  const notifiedDraft = React.useRef<OracleProfileContext | null>(null)
  draftListener.current = onDraft
  React.useEffect(() => {
    if (dirty.current && notifiedDraft.current !== draft) { notifiedDraft.current = draft; draftListener.current(draft) }
  }, [draft])
  const question = index === null ? null : ORACLE_CONTEXT_QUESTIONS[index]!
  const grouped = [[0, 1, 4, 5], [2, 3, 10, 11], [6, 7], [8, 9, 12], []]
  React.useEffect(() => {
    const target = conditionsView ? ref.current?.querySelector<HTMLElement>(".oracle-v2__conditions h2") : heading.current
    target?.focus({ preventScroll: true })
  }, [index, conditionsView])
  const change = (value: string) => {
    if (!question || busy) return
    const current = draft.answers[question.id]
    const values = Array.isArray(current) ? current as readonly string[] : []
    const candidate = { ...draft, answers: { ...draft.answers, [question.id]: question.multiple
      ? values.includes(value) ? values.filter(item => item !== value) : [...values, value] : value } }
    const parsed = oracleProfileContextSchema.safeParse(candidate)
    if (!parsed.success) return
    dirty.current = true; setSaved(false); setFailed(false); setDraft(parsed.data)
    if (!question.multiple) setIndex(null)
  }
  return <dialog ref={ref} className="oracle-v2 oracle-v2__dialog" aria-label="추가 응답" onCancel={event => { event.preventDefault(); close() }}>
    <header className="oracle-v2__chrome"><button type="button" disabled={busy} aria-label="항목 목록으로" title="항목 목록으로" onClick={() => { if (finishConditions()) { setIndex(null); setConditionsView(null) } }}><ArrowLeft size={18} /></button><span>원하는 항목만 알려주세요</span><button type="button" disabled={busy} aria-label="닫기" title="닫기" onClick={close}><X size={18} /></button></header>
    <div className="oracle-v2__reader-body">
      {conditionsView ? <><OracleConditionsFields ref={conditions} key={conditionsView} kind={conditionsView} value={draft.conditions} records={records} onChange={conditions => {
        const next = { ...draft, conditions }; dirty.current = true; setSaved(false); setFailed(false); setDraft(next)
        notifiedDraft.current = next; draftListener.current(next)
      }} /><button type="button" onClick={() => { if (finishConditions()) setConditionsView(null) }}>입력 마치기<Check size={16} /></button></> : question ? <><h1 ref={heading} tabIndex={-1}>{question.title}</h1><div className="oracle-v2__choices app-choice-group">{question.options.map(([value, label]) => {
        const selected = draft.answers[question.id], pressed = Array.isArray(selected) ? (selected as string[]).includes(value) : selected === value
        return <button className="app-choice-control app-choice-control--answer" type="button" key={value} disabled={busy} aria-pressed={pressed} onClick={() => change(value)}>{label}{pressed && <Check size={16} />}</button>
      })}</div>{question.multiple && <button type="button" onClick={() => setIndex(null)}>선택 완료<Check size={16} /></button>}<button type="button" onClick={() => { const next = { ...draft, answers: { ...draft.answers } }; delete next.answers[question.id]; dirty.current = true; setSaved(false); setDraft(next); setIndex(null) }}>답하지 않기</button></> : <>
        <h1 ref={heading} tabIndex={-1}>조금 더 나답게</h1><p>여기서 고른 답은 점수에 더하지 않아요. 관련된 풀이에만 사용해요.</p>
        <div className="oracle-v2__groups app-choice-group" role="group" aria-label="추가 응답 주제">{["달리기", "함께", "보조 운동", "대회", "시간·장소"].map((label, n) => <button className="app-choice-control" type="button" key={label} aria-pressed={group === n} onClick={() => setGroup(n)}>{label}</button>)}</div>
        <div className="oracle-v2__topics">{ORACLE_CONTEXT_QUESTIONS.map((item, n) => grouped[group]!.includes(n) ? <button type="button" key={item.id} disabled={busy} onClick={() => setIndex(n)}>{item.title}{draft.answers[item.id] !== undefined ? <Check size={16} aria-label="응답 있음" /> : <ChevronRight size={16} />}</button> : null)}</div>
        {group === 1 && <button type="button" onClick={() => setConditionsView("meeting")}>함께 달릴 수 있는 시간<ChevronRight size={16} /></button>}
        {group === 3 && <div className="oracle-v2__topics"><button type="button" onClick={() => setConditionsView("race")}>경기별 코스와 날씨<ChevronRight size={16} /></button><button type="button" onClick={() => setConditionsView("event")}>대회 일정·이동·비용<ChevronRight size={16} /></button></div>}
        {group === 4 && <><label>운동할 수 있는 시간 (분)<input type="number" min="0" max="1440" inputMode="numeric" value={draft.conditions.availableMinutes ?? ""} onChange={event => {
          const raw = event.currentTarget.value, number = raw === "" ? undefined : Number(raw)
          if (number !== undefined && (!Number.isFinite(number) || number < 0 || number > 1440)) return
          dirty.current = true; setSaved(false); setDraft({ ...draft, conditions: { ...draft.conditions, availableMinutes: number } })
        }} /></label>
        <h2>가능한 장소</h2><div className="oracle-v2__groups app-choice-group">{([["TRACK", "트랙"], ["ROAD", "도로"], ["TRAIL", "트레일"], ["HILL", "언덕"], ["GYM", "체육관"], ["INDOOR", "실내"]] as const).map(([value, label]) => <button className="app-choice-control" type="button" key={value} aria-pressed={draft.conditions.places?.includes(value) ?? false} onClick={() => {
          const values = draft.conditions.places ?? []; dirty.current = true; setSaved(false); setDraft({ ...draft, conditions: { ...draft.conditions, places: values.includes(value) ? values.filter(v => v !== value) : [...values, value] } })
        }}>{label}</button>)}</div>
        <h2>사용할 수 있는 장비</h2><div className="oracle-v2__groups app-choice-group">{([["NONE", "별도 장비 없음"], ["WEIGHTS", "웨이트"], ["BIKE", "자전거"], ["TREADMILL", "트레드밀"]] as const).map(([value, label]) => <button className="app-choice-control" type="button" key={value} aria-pressed={draft.conditions.equipment?.includes(value) ?? false} onClick={() => {
          const values = draft.conditions.equipment ?? []; dirty.current = true; setSaved(false); setDraft({ ...draft, conditions: { ...draft.conditions, equipment: values.includes(value) ? values.filter(v => v !== value) : value === "NONE" ? [value] : [...values.filter(v => v !== "NONE"), value] } })
        }}>{label}</button>)}</div></>}
        {failed && <p role="alert">저장을 확인하지 못했어요. 입력한 답은 이 화면에 남아 있어요.</p>}
        {saved && <p role="status">응답을 반영했어요.</p>}
        <button type="button" disabled={busy || saved} onClick={async () => {
          setBusy(true); setFailed(false)
          try { const ok = await onSave({ ...draft, answeredAt: new Date().toISOString() }); setFailed(!ok); setSaved(ok); if (ok) dirty.current = false }
          catch { setFailed(true) } finally { setBusy(false) }
        }}>{busy ? "저장 중" : "응답 반영"}<Check size={16} /></button>
      </>}
    </div>
  </dialog>
}
