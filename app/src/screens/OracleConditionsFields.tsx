import React from "react"
import { Check, Pencil, Plus, Trash2 } from "lucide-react"
import { oracleContextConditionsSchema, type OracleProfileContext } from "../domain/oracle-profile-context"
import type { AthleteRecord } from "../domain/athlete-records"

type Conditions = OracleProfileContext["conditions"]
type Race = NonNullable<Conditions["races"]>[number]
type Event = NonNullable<Conditions["events"]>[number]
type Meeting = NonNullable<Conditions["meetingWindows"]>[number]
const asTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
const asMinute = (time: string) => /^\d{2}:\d{2}$/u.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : Number.NaN
const optionalNumber = (value: string) => value === "" ? undefined : Number(value)

export type OracleConditionsHandle = { finish: () => boolean }

export const OracleConditionsFields = React.forwardRef<OracleConditionsHandle, {
  kind: "race" | "event" | "meeting"; value: Conditions; records: readonly AthleteRecord[] | null; onChange: (next: Conditions) => void
}>(function OracleConditionsFields({ kind, value, records, onChange }, ref) {
  const [race, setRace] = React.useState<Race | null>(null)
  const [eventId, setEventId] = React.useState<string | null>(null)
  const [date, setDate] = React.useState("")
  const [travel, setTravel] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [currency, setCurrency] = React.useState<NonNullable<Event["cost"]>["currency"]>("KRW")
  const [start, setStart] = React.useState("")
  const [end, setEnd] = React.useState("")
  const [error, setError] = React.useState("")
  const [saved, setSaved] = React.useState(false)
  const pending = React.useRef(false)
  const commit = (candidate: Conditions, clearPending = true) => {
    const parsed = oracleContextConditionsSchema.safeParse(candidate)
    if (!parsed.success) { setError("날짜와 숫자를 확인해 주세요. 모르는 값은 비워 둬도 돼요."); return false }
    onChange(parsed.data); if (clearPending) pending.current = false; setError(""); setSaved(clearPending); return true
  }
  const change = (run: () => void) => { pending.current = true; setSaved(false); setError(""); run() }
  const saveEvent = () => {
    const entry: Event = { id: eventId ?? crypto.randomUUID(), date, travelMinutes: optionalNumber(travel), cost: amount === "" ? undefined : { amount: Number(amount), currency } }
    if (!commit({ ...value, events: [...(value.events ?? []).filter(item => item.id !== eventId), entry] })) return false
    setEventId(null); setDate(""); setTravel(""); setAmount(""); return true
  }
  const saveMeeting = () => {
    const entry: Meeting = { date, startMinute: asMinute(start), endMinute: asMinute(end) }
    if (!commit({ ...value, meetingWindows: [...(value.meetingWindows ?? []), entry] })) return false
    setDate(""); setStart(""); setEnd(""); return true
  }
  const finish = () => {
    if (!pending.current) return true
    if (kind === "race") return !race || commit({ ...value, races: [...(value.races ?? []).filter(item => item.recordId !== race.recordId), race] })
    // Clearing an unsaved row is not an instruction to create an empty event.
    if (!date && !travel && !amount && !start && !end && eventId === null) { pending.current = false; return true }
    return kind === "event" ? saveEvent() : saveMeeting()
  }
  React.useImperativeHandle(ref, () => ({ finish }))
  const editEvent = (item: Event) => {
    // Switching rows must not replace raw input, including invalid input.
    if (eventId !== item.id && !finish()) return
    if (eventId === item.id && pending.current) return
    change(() => { setEventId(item.id); setDate(item.date); setTravel(item.travelMinutes === undefined ? "" : String(item.travelMinutes)); setAmount(item.cost ? String(item.cost.amount) : ""); setCurrency(item.cost?.currency ?? "KRW") })
  }
  const actualRecords = records?.filter(record => record.purpose !== "RACE_GOAL")
  const raceLabel = (record: AthleteRecord) => `${record.eventDistanceM >= 1000 ? `${record.eventDistanceM / 1000}km` : `${record.eventDistanceM}m`} · ${record.achievedOn ?? "날짜 미입력"}`
  return <section className="oracle-v2__conditions">
    <h2 tabIndex={-1}>{kind === "race" ? "경기 조건" : kind === "event" ? "대회 일정과 비용" : "함께 달릴 시간"}</h2>
    {kind === "race" ? <>
      {records === null ? <p>경기 기록을 아직 확인하지 못했어요.</p> : actualRecords?.length === 0 ? <p>경기 기록을 먼저 남기면 그날의 조건을 연결할 수 있어요.</p> : <label>경기 선택<select value={race?.recordId ?? ""} onChange={e => { const id = e.target.value; if (finish()) change(() => setRace(id ? value.races?.find(item => item.recordId === id) ?? { recordId: id } : null)) }}>
        <option value="">선택해 주세요</option>{actualRecords?.map(record => <option key={record.id} value={record.id}>{raceLabel(record)}</option>)}
      </select></label>}
      {race && <>
        <label>코스<select value={race.course ?? ""} onChange={e => change(() => setRace({ ...race, course: (e.target.value || undefined) as Race["course"] }))}><option value="">모름</option><option value="TRACK">트랙</option><option value="ROAD">도로</option><option value="TRAIL">트레일</option><option value="HILLY">언덕이 있는 코스</option></select></label>
        <label>날씨<select value={race.weather ?? ""} onChange={e => change(() => setRace({ ...race, weather: (e.target.value || undefined) as Race["weather"] }))}><option value="">모름</option><option value="DRY">비 없이 달림</option><option value="RAIN">비</option><option value="WIND">바람</option><option value="HEAT">더위</option><option value="COLD">추위</option></select></label>
        <label>경기 단계<select value={race.round ?? ""} onChange={e => change(() => setRace({ ...race, round: (e.target.value || undefined) as Race["round"] }))}><option value="">모름</option><option value="HEAT">예선</option><option value="SEMIFINAL">준결승</option><option value="FINAL">결승</option><option value="TIMED">기록으로 순위 결정</option></select></label>
        <label>그 경기의 목표<select value={race.goal ?? ""} onChange={e => change(() => setRace({ ...race, goal: (e.target.value || undefined) as Race["goal"] }))}><option value="">미입력</option><option value="RECORD">목표 기록</option><option value="FINISH">완주</option><option value="EXPERIENCE">경험</option><option value="RANK">순위</option><option value="QUALIFY">예선 통과</option><option value="REFRESH">기분 전환</option><option value="ROUTINE">꾸준한 일상</option><option value="LEARN">배움</option></select></label>
        <button type="button" disabled={saved} onClick={() => commit({ ...value, races: [...(value.races ?? []).filter(item => item.recordId !== race.recordId), race] })}><Check size={16} />이 경기 조건 반영</button>
        {value.races?.some(item => item.recordId === race.recordId) && <button type="button" onClick={() => { if (commit({ ...value, races: value.races?.filter(item => item.recordId !== race.recordId) })) setRace(null) }}><Trash2 size={16} />조건 지우기</button>}
      </>}
    </> : <>
      <label>날짜<input type="date" value={date} onChange={e => change(() => setDate(e.target.value))} /></label>
      {kind === "event" ? <>
        <label>이동 시간 (분) · 선택<input type="number" inputMode="numeric" min="0" max="10080" value={travel} onChange={e => change(() => setTravel(e.target.value))} /></label>
        <label>예상 비용 · 선택<input type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={e => change(() => setAmount(e.target.value))} /></label>
        <label>통화<select value={currency} onChange={e => change(() => setCurrency(e.target.value as typeof currency))}><option value="KRW">원 (KRW)</option><option value="USD">달러 (USD)</option><option value="JPY">엔 (JPY)</option><option value="EUR">유로 (EUR)</option><option value="GBP">파운드 (GBP)</option></select></label>
        <button type="button" disabled={!date || saved} onClick={saveEvent}>{eventId ? <Check size={16} /> : <Plus size={16} />}{eventId ? "일정 수정" : "일정 추가"}</button>
        {value.events?.map(item => <div className="oracle-v2__condition-row" key={item.id}><span>{item.date}<small>{item.travelMinutes === undefined ? "이동 미입력" : `이동 ${item.travelMinutes}분`} · {item.cost ? `${item.cost.amount.toLocaleString("ko-KR")} ${item.cost.currency}` : "비용 미입력"}</small></span><button type="button" aria-label={`${item.date} 일정 수정`} title="일정 수정" onClick={() => editEvent(item)}><Pencil size={16} /></button><button type="button" title="일정 삭제" aria-label={`${item.date} 일정 삭제`} onClick={() => { if (commit({ ...value, events: value.events?.filter(entry => entry.id !== item.id) }, eventId === item.id || !pending.current) && eventId === item.id) { setEventId(null); setDate(""); setTravel(""); setAmount("") } }}><Trash2 size={16} /></button></div>)}
      </> : <>
        <label>시작<input type="time" value={start} onChange={e => change(() => setStart(e.target.value))} /></label>
        <label>끝<input type="time" value={end} onChange={e => change(() => setEnd(e.target.value))} /></label>
        <button type="button" disabled={!date || !start || !end || saved} onClick={saveMeeting}><Plus size={16} />시간 추가</button>
        {value.meetingWindows?.map((item, index) => <div className="oracle-v2__condition-row" key={`${item.date}-${index}`}><span>{item.date}<small>{asTime(item.startMinute)} ~ {asTime(item.endMinute)}</small></span><button type="button" aria-label={`${item.date} ${asTime(item.startMinute)} 시간 삭제`} title="시간 삭제" onClick={() => commit({ ...value, meetingWindows: value.meetingWindows?.filter((_entry, n) => n !== index) }, !pending.current)}><Trash2 size={16} /></button></div>)}
      </>}
    </>}
    {error && <p role="alert">{error}</p>}{saved && <p role="status">추가 응답에 반영했어요. 전체 저장은 ‘응답 반영’을 눌러 주세요.</p>}
  </section>
})
