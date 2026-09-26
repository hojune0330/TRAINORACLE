import React from "react"
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Trash2, Undo2, X } from "lucide-react"
import { EXERCISE_KINDS, cloneExercise, describeExerciseRow, exerciseComponentSchema, type ExerciseComponent, type ExerciseLog } from "../../domain/exercise-log"
import type { ExerciseEditorDraft } from "./form-input-draft"
import { parseDecimalString } from "../../domain/numeric-input"
import "./exercise-log-editor.css"

type RowDraft = ExerciseEditorDraft["rows"][number]
const blankRow = (): RowDraft => ({ id: crypto.randomUUID(), distanceM: "", durationSeconds: "", repetitions: "", sets: "", loadKg: "", contacts: "", side: "", recoveryKind: "", recoverySeconds: "", setRecoveryKind: "", setRecoverySeconds: "" })
const newDraft = (): ExerciseEditorDraft => ({ id: crypto.randomUUID(), kind: "RUNNING", name: "", rows: [] })
const NUMBERS = { distanceM: "거리 (m)", durationSeconds: "시간 (초)", repetitions: "반복 횟수", sets: "세트 수", loadKg: "중량 (kg)", contacts: "접지 수" } as const
const KEYS: Record<ExerciseComponent["kind"], readonly (keyof typeof NUMBERS)[]> = {
  RUNNING: ["distanceM", "durationSeconds"], INTERVALS: ["distanceM", "durationSeconds", "repetitions", "sets"],
  STRENGTH: ["loadKg", "repetitions", "sets"], PLYOMETRIC: ["distanceM", "contacts", "repetitions", "sets"],
  CROSS_TRAINING: ["durationSeconds", "distanceM"], OTHER: ["distanceM", "durationSeconds", "repetitions", "sets", "loadKg", "contacts"],
}
function toDraft(item: ExerciseComponent): ExerciseEditorDraft {
  return { ...item, rows: item.rows.map(row => ({ ...blankRow(), id: row.id,
    ...Object.fromEntries(Object.keys(NUMBERS).map(key => [key, row[key as keyof typeof NUMBERS] === undefined ? "" : String(row[key as keyof typeof NUMBERS])])),
    side: row.side ?? "", recoveryKind: row.recovery?.kind ?? "", recoverySeconds: row.recovery?.kind === "TIMED" ? String(row.recovery.seconds) : "",
    setRecoveryKind: row.setRecovery?.kind ?? "", setRecoverySeconds: row.setRecovery?.kind === "TIMED" ? String(row.setRecovery.seconds) : "",
  })) }
}
export function buildExerciseDraft(draft: ExerciseEditorDraft): ExerciseComponent | null {
  const rows: unknown[] = []
  for (const row of draft.rows) {
    const value: Record<string, unknown> = { id: row.id }
    for (const key of Object.keys(NUMBERS) as (keyof typeof NUMBERS)[]) {
      if (row[key].trim() !== "") value[key] = parseDecimalString(row[key])
    }
    if (row.side) value.side = row.side
    if (row.recoveryKind) value.recovery = row.recoveryKind === "NONE" ? { kind: "NONE" } : { kind: "TIMED", seconds: parseDecimalString(row.recoverySeconds) }
    if (row.setRecoveryKind) value.setRecovery = row.setRecoveryKind === "NONE" ? { kind: "NONE" } : { kind: "TIMED", seconds: parseDecimalString(row.setRecoverySeconds) }
    rows.push(value)
  }
  const parsed = exerciseComponentSchema.safeParse({ id: draft.id, kind: draft.kind, name: draft.name.trim(), rows })
  return parsed.success ? parsed.data : null
}

export function ExerciseLogSummary({ log }: { readonly log?: ExerciseLog }) {
  if (!log?.components.length) return null
  return <ul className="exercise-records" aria-label="실제로 한 운동">
    {log.components.map(item => <li key={item.id}>
      <strong>{item.name || EXERCISE_KINDS[item.kind]}</strong>
      {item.rows.length === 0 ? <span>종류만 기록</span> : item.rows.map((row, i) => <span key={row.id}>{item.rows.length > 1 ? `${i + 1}. ` : ""}{describeExerciseRow(row)}</span>)}
    </li>)}
  </ul>
}

export function ExerciseLogEditor({ value, onChange, draft, onDraftChange, recent = [] }: {
  readonly value: ExerciseLog
  readonly onChange: (value: ExerciseLog) => void
  readonly draft?: ExerciseEditorDraft
  readonly onDraftChange: (draft: ExerciseEditorDraft | undefined) => void
  readonly recent?: readonly ExerciseComponent[]
}) {
  const [open, setOpen] = React.useState(draft !== undefined)
  const [error, setError] = React.useState(false)
  const [deleted, setDeleted] = React.useState<{ item: ExerciseComponent; index: number } | null>(null)
  const [deletedRow, setDeletedRow] = React.useState<{ ownerId: string; kind: ExerciseComponent["kind"]; row: RowDraft; index: number } | null>(null)
  const editing = draft
  const write = (next: ExerciseEditorDraft) => { onDraftChange(next); setError(false) }
  const changeRow = (index: number, key: keyof RowDraft, next: string) => {
    if (editing) write({ ...editing, rows: editing.rows.map((row, i) => i === index ? { ...row, [key]: next } : row) })
  }
  const begin = (item?: ExerciseComponent) => {
    write(item ? toDraft(item) : editing ?? newDraft()); setOpen(true)
  }
  const apply = () => {
    if (!editing) return
    const item = buildExerciseDraft(editing)
    if (!item) { setError(true); return }
    const exists = value.components.some(current => current.id === item.id)
    if (!exists && value.components.length >= 24) return
    onChange({ ...value, components: exists ? value.components.map(current => current.id === item.id ? item : current) : [...value.components, item] })
    onDraftChange(undefined); setOpen(false); setDeletedRow(null)
  }
  const move = (index: number, shift: number) => {
    const components = [...value.components]
    const target = index + shift
    if (target < 0 || target >= components.length) return
    ;[components[index], components[target]] = [components[target]!, components[index]!]
    onChange({ ...value, components })
  }
  return <div className="exercise-editor">
    <p>같은 시간에 한 운동을 함께 남겨요. 오전·오후를 따로 남기려면 새 일지를 쓰세요.</p>
    {value.components.map((item, index) => <section key={item.id} className="exercise-editor__item" aria-label={`운동 ${index + 1}`}>
      <ExerciseLogSummary log={{ ...value, components: [item] }} />
      <div className="exercise-editor__tools">
        <button type="button" title="수정" aria-label={`운동 ${index + 1} 수정`} disabled={editing !== undefined} onClick={() => begin(item)}><Pencil size={18} /></button>
        <button type="button" title="복제" aria-label={`운동 ${index + 1} 복제`} disabled={value.components.length >= 24} onClick={() => onChange({ ...value, components: [...value.components, cloneExercise(item)] })}><Copy size={18} /></button>
        <button type="button" title="앞으로" aria-label={`운동 ${index + 1} 앞으로`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={18} /></button>
        <button type="button" title="뒤로" aria-label={`운동 ${index + 1} 뒤로`} disabled={index === value.components.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18} /></button>
        <button type="button" title="삭제" aria-label={`운동 ${index + 1} 삭제`} disabled={editing?.id === item.id} onClick={() => { setDeleted({ item, index }); onChange({ ...value, components: value.components.filter(x => x.id !== item.id) }) }}><Trash2 size={18} /></button>
      </div>
    </section>)}
    {deleted && <button type="button" className="exercise-editor__action" disabled={value.components.length >= 24} onClick={() => {
      const components = [...value.components]; components.splice(deleted.index, 0, deleted.item)
      onChange({ ...value, components }); setDeleted(null)
    }}><Undo2 size={18} />삭제 취소</button>}
    {!open && <button type="button" className="exercise-editor__action" disabled={value.components.length >= 24 && !editing} onClick={() => begin()}><Plus size={18} />{editing ? "작성하던 운동 계속" : "운동 추가"}</button>}
    {open && editing && <section className="exercise-editor__form" aria-label="운동 내용 작성">
      <h2>어떤 운동을 했나요?</h2>
      <div className="exercise-editor__kinds" role="group" aria-label="운동 종류">
        {Object.entries(EXERCISE_KINDS).map(([kind, label]) => <button key={kind} type="button" aria-pressed={editing.kind === kind} onClick={() => {
          if (kind === editing.kind) return
          write({ ...editing, kind: kind as ExerciseComponent["kind"], name: editing.previousKinds?.[kind]?.name ?? "", rows: editing.previousKinds?.[kind]?.rows ?? [],
            previousKinds: { ...editing.previousKinds, [editing.kind]: { name: editing.name, rows: editing.rows } } })
        }}>{label}</button>)}
      </div>
      <label>운동 이름 · 선택<input aria-label="운동 이름" maxLength={80} value={editing.name} onChange={event => write({ ...editing, name: event.target.value })} /></label>
      {editing.rows.length > 0 && <p>거리·시간은 한 번의 운동 기준이에요. 반복 횟수는 한 세트 안에서 한 횟수예요.</p>}
      {editing.rows.map((row, index) => <fieldset key={row.id}>
        <legend>{index + 1}번 구간</legend>
        <div className="exercise-editor__fields">
          {KEYS[editing.kind].map(key => <label key={key}>{NUMBERS[key]}<input aria-label={`${index + 1}번 ${NUMBERS[key]}`} type="text" inputMode="decimal" value={row[key]} onChange={event => changeRow(index, key, event.target.value)} /></label>)}
          {(editing.kind === "STRENGTH" || editing.kind === "PLYOMETRIC") && <label>좌우<select aria-label={`${index + 1}번 좌우`} value={row.side} onChange={event => changeRow(index, "side", event.target.value)}><option value="">미기록</option><option value="LEFT">왼쪽</option><option value="RIGHT">오른쪽</option><option value="BOTH">양쪽</option></select></label>}
        </div>
        <div className="exercise-editor__fields">
          {(["recovery", "setRecovery"] as const).map(key => <React.Fragment key={key}>
            <label>{key === "recovery" ? "반복 사이 회복" : "세트 사이 회복"}<select aria-label={`${index + 1}번 ${key === "recovery" ? "반복" : "세트"} 회복`} value={row[`${key}Kind`]} onChange={event => changeRow(index, `${key}Kind`, event.target.value)}><option value="">미기록</option><option value="NONE">회복 없음</option><option value="TIMED">시간 입력</option></select></label>
            {row[`${key}Kind`] === "TIMED" && <label>회복 (초)<input aria-label={`${index + 1}번 ${key === "recovery" ? "반복" : "세트"} 회복 초`} inputMode="decimal" value={row[`${key}Seconds`]} onChange={event => changeRow(index, `${key}Seconds`, event.target.value)} /></label>}
          </React.Fragment>)}
        </div>
        <button type="button" title="구간 삭제" aria-label={`${index + 1}번 구간 삭제`} onClick={() => {
          setDeletedRow({ ownerId: editing.id, kind: editing.kind, row, index })
          write({ ...editing, rows: editing.rows.filter(x => x.id !== row.id) })
        }}><X size={18} /></button>
      </fieldset>)}
      {deletedRow?.ownerId === editing.id && deletedRow.kind === editing.kind && <button type="button" className="exercise-editor__action" disabled={editing.rows.length >= 64} onClick={() => {
        const rows = [...editing.rows]
        rows.splice(deletedRow.index, 0, deletedRow.row)
        write({ ...editing, rows }); setDeletedRow(null)
      }}><Undo2 size={18} />구간 삭제 취소</button>}
      <button type="button" className="exercise-editor__action" disabled={editing.rows.length >= 64} onClick={() => write({ ...editing, rows: [...editing.rows, blankRow()] })}><Plus size={18} />{editing.rows.length ? "다른 반복·세트 추가" : "거리·시간·횟수 적기"}</button>
      {editing.copiedFromPrevious && <p role="status">지난 기록을 불러왔어요. 오늘 실제로 한 값으로 고친 뒤 반영해 주세요.</p>}
      {error && <p role="alert">입력한 숫자를 확인해 주세요. 모르는 칸은 비워도 돼요. 횟수·세트는 양의 정수, 거리·운동 시간은 0보다 커야 해요.</p>}
      <div className="exercise-editor__actions">
        <button type="button" onClick={apply}>내용 반영</button>
        <button type="button" onClick={() => setOpen(false)}>접기 · 입력 유지</button>
        <button type="button" onClick={() => { onDraftChange(undefined); setOpen(false); setDeletedRow(null) }}>작성 내용 버리기</button>
      </div>
    </section>}
    {!open && !editing && recent.length > 0 && value.components.length < 24 && <details>
      <summary>지난 운동 구성으로 작성</summary>
      {recent.slice(0, 6).map((item, index) => <button key={`${item.id}-${index}`} type="button" className="exercise-editor__action" onClick={() => { write({ ...toDraft(cloneExercise(item)), copiedFromPrevious: true }); setOpen(true) }}>{item.name || EXERCISE_KINDS[item.kind]}</button>)}
    </details>}
  </div>
}
