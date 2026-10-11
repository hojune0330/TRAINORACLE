import React from "react"
import { ArrowLeft, Eye, Users, X } from "lucide-react"
import { createSelfReportedAthleteRecord, type AthleteRecord } from "../domain/athlete-records"
import { READING_EVENTS, parseReadingTime } from "../domain/record-reading-oracle"
import { ORACLE_AXES, ORACLE_QUESTIONS, ORACLE_NON_NUMERIC, type OracleResponses, type OracleResponse } from "../domain/oracle-profile-v2"
import { makeOracleProfileRevision, type OracleProfileRevision } from "../domain/oracle-profile-snapshot"
import {
  createOracleFriendComparisonSession, formatOracleFriendFact, oracleFriendFactLabel, ORACLE_FRIEND_FIELDS,
  ORACLE_FRIEND_GOALS, ORACLE_FRIEND_PHASES, ORACLE_FRIEND_TOPICS,
  type OracleFriendField, type OracleFriendManualData, type OracleFriendSelf, type OracleFriendTopic,
} from "../domain/oracle-friend-comparison-v2"
import "./oracle-friend-comparison-v2.css"

export interface OracleFriendComparisonV2Props {
  today: string
  ownProfile: OracleProfileRevision | null
  /** null is unavailable; [] is a successfully received empty collection. */
  records: readonly AthleteRecord[] | null
  onBack: () => void
}
const topicNames = { E01: "경기 기록", E02: "함께할 구간", E03: "응답 비교", E04: "당일 목표", E05: "훈련 구성", E06: "공유 범위" }
const goalNames = { RECORD: "기록 도전", FINISH: "완주", EXPERIENCE: "새 경험", RANK: "순위", QUALIFY: "진출", REFRESH: "기분 전환", ROUTINE: "일상 유지", LEARN: "배우기" }
const phaseNames = { WARMUP: "준비 운동", MAIN: "본운동", RECOVERY: "회복", COOLDOWN: "정리 운동" }
const responseNames = { UNKNOWN: "모르겠어요", VARIES: "상황에 따라 달라요", INEXPERIENCED: "경험이 없어요", SKIPPED: "건너뛰기" }
const statusNames = { SUFFICIENT: "확인한 자료", PARTIAL: "일부 자료만 확인", MISSING: "입력한 자료 없음", UNAVAILABLE: "자료 확인 필요", REVOKED: "동의 철회" }

function Choices<T extends string>({ title, options, names, value = [], onChange }: {
  title: string; options: readonly T[]; names: Record<T, string>; value?: readonly T[]; onChange: (value: T[]) => void
}) {
  return <fieldset><legend>{title}</legend><div className="oracle-friend__choices">{options.map(option => <label key={option}>
    <input type="checkbox" checked={value.includes(option)} onChange={e => onChange(e.target.checked ? [...value, option] : value.filter(v => v !== option))} />
    <span>{names[option]}</span>
  </label>)}</div></fieldset>
}

/** Parent embeds in dev preview only and unmounts on owner/logout/deletion transitions. */
export function OracleFriendComparisonV2({ today, ownProfile, records, onBack }: OracleFriendComparisonV2Props) {
  const [session] = React.useState(createOracleFriendComparisonSession)
  const [, refresh] = React.useReducer(n => n + 1, 0)
  const [own, setOwn] = React.useState<OracleFriendManualData>({})
  const [topic, setTopic] = React.useState<OracleFriendTopic>("E01")
  const [exportFields, setExportFields] = React.useState<OracleFriendField[]>([])
  const [preview, setPreview] = React.useState(false)
  const [error, setError] = React.useState("")
  const [epoch, setEpoch] = React.useState(0)
  React.useEffect(() => () => session.close(), [session])
  // A changed own revision/record set invalidates permission to export the previous result.
  React.useEffect(() => { session.setExternalShare(false, []); setPreview(false); refresh() }, [session, ownProfile, records, today])
  const snapshot = session.snapshot()
  const self: OracleFriendSelf = { ...own, profile: ownProfile, records }
  const reading = session.read(topic, self, today)
  const exportText = preview ? session.exportPreview(self, today) : null
  const invalidate = () => { session.setExternalShare(false, []); setPreview(false); setExportFields([]); setError("") }
  const revoke = () => { session.revoke(); invalidate(); setOwn({}); setEpoch(n => n + 1); refresh() }
  const updatePeer = (patch: Partial<OracleFriendManualData>) => {
    invalidate()
    if (!session.replacePeer({ ...snapshot.peer, ...patch }, today)) setError("입력 형식과 날짜를 확인해 주세요. 이전 친구 결과는 지웠어요.")
    refresh()
  }
  const updateOwn = (patch: Partial<OracleFriendManualData>) => { invalidate(); setOwn(current => ({ ...current, ...patch })) }
  const selected = (field: OracleFriendField) => snapshot.fields.includes(field)

  return <section className="oracle-friend" aria-label="오라클 친구 비교">
    <header className="oracle-friend__header"><button type="button" title="뒤로" aria-label="뒤로" onClick={() => { revoke(); onBack() }}><ArrowLeft size={20} aria-hidden="true" /></button><span>오라클 · 친구 비교</span>
      {snapshot.comparisonAllowed && <button type="button" onClick={revoke}><X size={18} aria-hidden="true" />동의 철회</button>}
    </header>
    <div className="oracle-friend__body">
      <h1><Users size={24} aria-hidden="true" />함께 살펴보기</h1>
      <p className="oracle-friend__notice">친구 자료는 이 화면에서만 사용해요. 닫거나 새로고침하면 사라지며 계정·서버에 저장되지 않아요. 수동 동의 확인은 서버 접근 권한이 아니에요.</p>
      <label className="oracle-friend__permission"><input type="checkbox" checked={snapshot.comparisonAllowed} onChange={e => {
        if (e.target.checked) { session.grantComparison(); refresh() } else revoke()
      }} /><span>친구가 직접 제공한 자료를 이 화면에서 비교하도록 명시적으로 허락했어요.</span></label>
      {snapshot.comparisonAllowed && <>
        <fieldset><legend>친구가 비교를 허락한 항목</legend><div className="oracle-friend__choices">{ORACLE_FRIEND_FIELDS.map(field => <label key={field.id}>
          <input type="checkbox" checked={selected(field.id)} onChange={e => {
            invalidate(); session.selectFields(e.target.checked ? [...snapshot.fields, field.id] : snapshot.fields.filter(f => f !== field.id)); refresh()
          }} /><span>{field.label}</span>
        </label>)}</div></fieldset>
        <div key={epoch} className="oracle-friend__inputs">
          {selected("RECORDS") && <details open><summary>친구의 실제 경기 기록</summary><RecordForm today={today} onDirty={() => { invalidate(); refresh() }} onSave={record => updatePeer({ records: [record] })} />
            {snapshot.peer.records?.map(record => <p key={record.id}>입력됨 · {record.eventDistanceM}m · {record.performanceSeconds}초 · {record.achievedOn} · 직접 제공</p>)}
            {records === null && <p role="status">내 경기 기록을 확인하지 못했어요.</p>}
          </details>}
          {selected("PROFILE") && <details><summary>친구의 같은 버전 질문 응답</summary>
            <p>친구가 답한 항목만 입력해요. 아직 답하지 않은 항목은 그대로 비워 둡니다.</p>
            {ORACLE_AXES.map(axis => <fieldset key={axis.id}><legend>{axis.label}</legend>{ORACLE_QUESTIONS.filter(q => q.axisId === axis.id).map(question => <label className="oracle-friend__field" key={question.id}>
              <span>{question.text}</span><select value={snapshot.peer.profile?.answers[question.id] ?? ""} onChange={e => {
                const answers: OracleResponses = { ...snapshot.peer.profile?.answers }
                const value = e.target.value
                if (value === "") delete answers[question.id]
                else answers[question.id] = /^[1-5]$/u.test(value) ? Number(value) as OracleResponse : value as OracleResponse
                updatePeer({ profile: makeOracleProfileRevision({ revision: (snapshot.peer.profile?.revision ?? 0) + 1, answeredAt: new Date().toISOString(), answers }) })
              }}><option value="">미응답</option>{[1, 2, 3, 4, 5].map(n => <option value={n} key={n}>{n} · {n === 1 ? "전혀 동의하지 않음" : n === 5 ? "매우 동의함" : n === 3 ? "보통" : n === 2 ? "동의하지 않음" : "동의함"}</option>)}
                {ORACLE_NON_NUMERIC.map(value => <option key={value} value={value}>{responseNames[value]}</option>)}
              </select></label>)}</fieldset>)}
            {!ownProfile && <p>내 응답을 아직 확인할 수 없어요.</p>}
          </details>}
          {selected("GOALS") && <details open><summary>당일 목표</summary>
            <Choices title="내 당일 목표" options={ORACLE_FRIEND_GOALS} names={goalNames} value={own.goals} onChange={goals => updateOwn({ goals })} />
            <Choices title="친구 당일 목표" options={ORACLE_FRIEND_GOALS} names={goalNames} value={snapshot.peer.goals} onChange={goals => updatePeer({ goals })} />
          </details>}
          {selected("PHASES") && <details open><summary>함께하고 싶은 구간</summary>
            <Choices title="내가 고른 구간" options={ORACLE_FRIEND_PHASES} names={phaseNames} value={own.phases} onChange={phases => updateOwn({ phases })} />
            <Choices title="친구가 고른 구간" options={ORACLE_FRIEND_PHASES} names={phaseNames} value={snapshot.peer.phases} onChange={phases => updatePeer({ phases })} />
          </details>}
          {selected("TIME") && <details><summary>함께 가능한 시간</summary>
            <WindowForm key={`own-time-${epoch}`} title="내 가능 시간" today={today} onDirty={() => { invalidate(); refresh() }} onSave={windows => updateOwn({ windows })} />
            <WindowForm key={`peer-time-${epoch}`} title="친구 가능 시간" today={today} onDirty={() => { invalidate(); refresh() }} onSave={windows => updatePeer({ windows })} />
          </details>}
          {selected("TRAINING") && <details><summary>같은 기간의 실제 훈련</summary>
            <TrainingForm title="내 훈련" today={today} onDirty={() => { invalidate(); refresh() }} onSave={training => updateOwn({ training })} />
            <TrainingForm title="친구 훈련" today={today} onDirty={() => { invalidate(); refresh() }} onSave={training => updatePeer({ training })} />
          </details>}
        </div>
        {error && <p role="alert">{error}</p>}
        <nav className="oracle-friend__topics app-choice-group" aria-label="비교 주제">{ORACLE_FRIEND_TOPICS.map(id => <button className="app-choice-control" type="button" key={id} aria-pressed={id === topic} onClick={() => setTopic(id)}>{topicNames[id]}</button>)}</nav>
        {reading && <article className="oracle-friend__reading" aria-label="현재 비교 결과"><h2>{reading.title}</h2><p className="oracle-friend__notice">{statusNames[reading.status]}</p>
          <dl>{reading.facts.map(fact => <div key={fact.id}><dt>{fact.owner === "FRIEND" ? "친구 · " : fact.owner === "SELF" ? "나 · " : "비교 · "}{oracleFriendFactLabel(fact)}</dt><dd>{formatOracleFriendFact(fact)}</dd></div>)}</dl>
          {[...new Set(reading.paragraphs)].filter(p => !reading.facts.some(f => p.startsWith(`${f.label}:`))).map((text, index) => <p key={index}>{text}</p>)}
          {reading.limitations.map(text => <p className="oracle-friend__notice" key={text}>{text}</p>)}
        </article>}
        <section aria-label="외부 공유 미리보기" className="oracle-friend__sharing"><h2>공유할 사실</h2>
          <fieldset><legend>외부 공유를 별도로 허락한 항목</legend><div className="oracle-friend__choices">{ORACLE_FRIEND_FIELDS.filter(f => selected(f.id)).map(field => <label key={field.id}>
            <input type="checkbox" checked={exportFields.includes(field.id)} onChange={e => { session.setExternalShare(false, []); setPreview(false); setExportFields(e.target.checked ? [...exportFields, field.id] : exportFields.filter(f => f !== field.id)); refresh() }} /><span>{field.label}</span>
          </label>)}</div></fieldset>
          <label className="oracle-friend__permission"><input type="checkbox" disabled={!exportFields.length} checked={snapshot.externalShareAllowed} onChange={e => { session.setExternalShare(e.target.checked, exportFields, self, today); setPreview(false); refresh() }} /><span>나와 친구가 위 항목의 외부 공유를 별도로 허락했어요.</span></label>
          <button type="button" disabled={!snapshot.externalShareAllowed} onClick={() => setPreview(true)}><Eye size={18} aria-hidden="true" />공유 미리보기</button>
          {exportText && <div className="oracle-friend__export" role="region" aria-label="허용된 사실 미리보기">{exportText}</div>}
          {preview && !exportText && <p role="status">공유할 수 있는 확인된 사실이 없어요.</p>}
          <p className="oracle-friend__notice">비교 허락만으로는 외부에 공유하지 않아요. 동의를 철회하면 이 화면의 친구 자료·비교·미리보기를 지워요. 이미 복사한 내용은 회수할 수 없어요.</p>
        </section>
      </>}
    </div>
  </section>
}

function RecordForm({ today, onSave, onDirty }: { today: string; onSave: (record: AthleteRecord) => void; onDirty: () => void }) {
  const [error, setError] = React.useState("")
  return <form onChange={onDirty} onSubmit={e => {
    e.preventDefault(); const data = new FormData(e.currentTarget); const seconds = parseReadingTime(String(data.get("time")))
    const record = seconds === null ? null : createSelfReportedAthleteRecord({ id: "manual-friend-race", purpose: "RECENT_RESULT", eventDistanceM: Number(data.get("event")), performanceSeconds: seconds, achievedOn: String(data.get("date")), seasonId: null }, new Date(`${today}T12:00:00`))
    if (!record) { setError("종목, 분:초 기록과 실제 달성일을 확인해 주세요."); return }
    setError(""); onSave(record)
  }}>
    <label className="oracle-friend__field">친구 경기 종목<select name="event" required defaultValue=""><option value="" disabled>선택</option>{READING_EVENTS.map(event => <option key={event.id} value={event.meters}>{event.label}</option>)}</select></label>
    <label className="oracle-friend__field">친구 경기 기록 · 분:초<input name="time" required autoComplete="off" placeholder="20:30" maxLength={12} /></label>
    <label className="oracle-friend__field">친구 기록 달성일<input name="date" type="date" required max={today} /></label>
    {error && <p role="alert">{error}</p>}<button type="submit">기록 반영</button>
  </form>
}

function WindowForm({ title, today, onSave, onDirty }: { title: string; today: string; onSave: (windows: NonNullable<OracleFriendManualData["windows"]>) => void; onDirty: () => void }) {
  const [error, setError] = React.useState("")
  return <form onChange={onDirty} onSubmit={e => {
    e.preventDefault(); const data = new FormData(e.currentTarget)
    const minutes = (name: string) => String(data.get(name)).split(":").reduce((sum, n) => sum * 60 + Number(n), 0)
    const startMinute = minutes("start"), endMinute = minutes("end")
    if (startMinute >= endMinute) { setError("끝나는 시간을 시작 시간 이후로 정해 주세요."); return }
    setError(""); onSave([{ date: String(data.get("date")), startMinute, endMinute }])
  }}><fieldset><legend>{title}</legend>
    <label className="oracle-friend__field">날짜<input name="date" aria-label={`${title} 날짜`} type="date" defaultValue={today} required /></label>
    <label className="oracle-friend__field">시작<input name="start" aria-label={`${title} 시작`} type="time" required /></label>
    <label className="oracle-friend__field">종료<input name="end" aria-label={`${title} 종료`} type="time" required /></label>
    {error && <p role="alert">{error}</p>}<button type="submit">{title} 반영</button>
  </fieldset></form>
}

function TrainingForm({ title, today, onSave, onDirty }: { title: string; today: string; onSave: (training: NonNullable<OracleFriendManualData["training"]>) => void; onDirty: () => void }) {
  const [sessions, setSessions] = React.useState<NonNullable<OracleFriendManualData["training"]>["sessions"]>([])
  const [error, setError] = React.useState("")
  return <form onChange={onDirty} onSubmit={e => {
    e.preventDefault(); const data = new FormData(e.currentTarget)
    const startDate = String(data.get("start")), endDate = String(data.get("end")), sessionDate = String(data.get("date"))
    const distance = String(data.get("distance")), purpose = String(data.get("purpose"))
    const next = [...sessions, { id: `manual-training-${sessions.length + 1}`, date: sessionDate, provenance: "EXPLICIT" as const, activity: "RUN" as const,
      ...(distance === "" ? {} : { distanceKm: Number(distance) }), ...(purpose ? { purpose: purpose as NonNullable<OracleFriendManualData["training"]>["sessions"][number]["purpose"] } : {}) }]
    if (startDate > endDate || next.some(s => s.date < startDate || s.date > endDate || s.date > today)) { setError("기간과 운동 날짜를 확인해 주세요."); return }
    setError(""); setSessions(next); onSave({ period: { startDate, endDate }, coverage: data.get("complete") ? "COMPLETE" : "PARTIAL", sessions: next })
  }}><fieldset><legend>{title}</legend>
    <label className="oracle-friend__field">기간 시작<input aria-label={`${title} 기간 시작`} name="start" type="date" defaultValue={today} max={today} required /></label>
    <label className="oracle-friend__field">기간 끝<input aria-label={`${title} 기간 끝`} name="end" type="date" defaultValue={today} max={today} required /></label>
    <label className="oracle-friend__field">운동 날짜<input aria-label={`${title} 운동 날짜`} name="date" type="date" defaultValue={today} max={today} required /></label>
    <label className="oracle-friend__field">실제 달린 거리 · km · 선택<input aria-label={`${title} 거리`} name="distance" type="number" min="0" step="any" /></label>
    <label className="oracle-friend__field">기록한 목적 · 선택<select name="purpose" aria-label={`${title} 목적`} defaultValue=""><option value="">미기록</option>{Object.entries({ BASE: "기초 지구력", REC: "회복", LT: "역치", VO2: "최대산소섭취", GLY: "해당", SPEED: "스피드", ATP_PC: "순발력", MIX: "혼합", OTHER: "기타" }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="oracle-friend__permission"><input name="complete" type="checkbox" onChange={e => {
      if (!sessions.length || !e.currentTarget.form) return
      const data = new FormData(e.currentTarget.form)
      const startDate = String(data.get("start")), endDate = String(data.get("end"))
      if (startDate > endDate || sessions.some(s => s.date < startDate || s.date > endDate)) { setError("기간과 운동 날짜를 확인해 주세요."); return }
      onSave({ period: { startDate, endDate }, coverage: e.target.checked ? "COMPLETE" : "PARTIAL", sessions })
    }} /><span>이 기간의 달리기를 빠짐없이 입력했어요.</span></label>
    <p>{sessions.length}개 반영</p>{error && <p role="alert">{error}</p>}<button type="submit">{title} 한 건 추가</button>
    <button type="button" onClick={() => { setSessions([]); onDirty(); onSave({ period: { startDate: today, endDate: today }, coverage: "PARTIAL", sessions: [] }) }}>입력 지우기</button>
  </fieldset></form>
}
