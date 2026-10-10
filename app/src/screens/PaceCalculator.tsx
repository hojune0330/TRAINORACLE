import React from "react"
import { ArrowLeft, ArrowRight, Calculator, Flag, HelpCircle, ListOrdered, Table2, LockKeyhole, UnlockKeyhole, X } from "lucide-react"
import { PACE_EVENT_METERS, canonicalPaceDistance, paceReferenceRange } from "@impl/prescription/record-pace"
import type { AthleteRecord } from "../domain/athlete-records"
import { todayISO } from "../domain/journal-store"
import { derivePaceRecordOptions } from "../domain/pace-record-options"
import { createSegmentRecordReference } from "../domain/catalog-pace-reference"
import { isEligiblePaceRecordCurrent } from "../domain/account/eligible-account-pace-records"
import { useEligibleAccountPaceRecords } from "../hooks/useEligibleAccountPaceRecords"
import { TaskGuide } from "../components/TaskGuide"
import { directPaceSeconds, equalDistanceSplits, nearbyPaceTable, paceClock, paceEventLabel, parsePaceClock,
  primaryPaceDistances, SPLIT_PAGE_SIZE, type PaceToolRequest, type PaceToolStage } from "../domain/pace-tools"
import "./pace-calculator.css"

function clockFields(seconds: number) {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60
  return { hours: hours ? String(hours) : "", minutes: String(minutes), seconds: String(Number((seconds % 60).toFixed(6))) }
}

function paceOverlayDepth(stage: PaceToolStage): number | null {
  const state = window.history.state
  if (typeof state !== "object" || state === null) return null
  const marker = (state as Record<string, unknown>).trainoracleOverlay
  if (typeof marker !== "object" || marker === null) return null
  const overlay = marker as Record<string, unknown>
  return overlay.kind === "pace" && overlay.stage === stage
    && Number.isInteger(overlay.depth) && (overlay.depth as number) > 0 && (overlay.depth as number) <= 100
    ? overlay.depth as number : null
}

const BADGES = { RECENT_ACTUAL: "최근 경기", ROLLING_12_BEST: "최근 12개월 최고", LIFETIME_BEST: "입력된 개인 최고", GOAL: "목표" } as const

export function PaceCalculator({ request = {}, stage, onStageChange, onBack }: {
  readonly request?: PaceToolRequest
  readonly stage: PaceToolStage
  readonly onStageChange: (stage: PaceToolStage) => void
  readonly onBack: () => void
}) {
  const { records, readRecords } = useEligibleAccountPaceRecords()
  const [event, setEvent] = React.useState(canonicalPaceDistance(request.record?.eventDistanceM ?? request.allowedEvents?.[0] ?? 5000))
  const [fields, setFields] = React.useState(request.record ? clockFields(request.record.performanceSeconds) : { hours: "", minutes: "", seconds: "" })
  const [selected, setSelected] = React.useState<AthleteRecord | undefined>(request.record)
  const [unit, setUnit] = React.useState("400")
  const [trend, setTrend] = React.useState<"even" | "faster" | "slower">("even")
  const [page, setPage] = React.useState(0)
  const [message, setMessage] = React.useState("")
  const [fixed, setFixed] = React.useState<{ source: string; values: Record<number, string> }>({ source: "", values: {} })
  const heading = React.useRef<HTMLHeadingElement>(null)
  const referenceFromEvent = React.useRef(false)
  const parsed = parsePaceClock(fields.hours, fields.minutes, fields.seconds)
  const total = parsed.kind === "valid" ? parsed.seconds : null
  const stale = selected !== undefined && !isEligiblePaceRecordCurrent(selected)
  const canSelect = request.onSelectRecord && selected && !stale
    && (request.allowedEvents?.some(value => canonicalPaceDistance(value) === event) ?? true)
  const closeTool = () => {
    const depth = paceOverlayDepth(stage)
    if (depth === null || depth === 1) onBack()
    else window.history.go(-depth)
  }
  React.useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [stage])
  React.useEffect(() => { setPage(0) }, [event, total, unit, trend])
  const setField = (key: keyof typeof fields, value: string) => {
    setFields(previous => ({ ...previous, [key]: value })); setSelected(undefined); setMessage("")
  }
  const chooseEvent = (value: number) => {
    setEvent(value); setFields({ hours: "", minutes: "", seconds: "" }); setSelected(undefined)
    setMessage(""); onStageChange("input")
  }
  const chooseRecord = (record: Pick<AthleteRecord, "id" | "savedAt">) => {
    const current = readRecords().find(row => row.id === record.id && row.savedAt === record.savedAt)
    if (!current || !isEligiblePaceRecordCurrent(current)) { setMessage("기록이 바뀌었어요. 다시 선택해 주세요."); return }
    setEvent(canonicalPaceDistance(current.eventDistanceM)); setFields(clockFields(current.performanceSeconds))
    setSelected({ ...current }); setMessage("")
    if (referenceFromEvent.current) onStageChange("result")
    else onBack()
  }
  const openRecords = () => {
    referenceFromEvent.current = stage === "event"
    onStageChange("reference")
  }
  const splitSource = JSON.stringify([event, total, unit, trend])
  const fixedValues = fixed.source === splitSource ? fixed.values : {}
  const splitResult = total === null ? null : equalDistanceSplits(total, event, Number(unit), trend,
    Object.fromEntries(Object.entries(fixedValues).map(([index, value]) => [index, /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN])))
  const baseSplitResult = total === null ? null : equalDistanceSplits(total, event, Number(unit), trend)
  const baseRows = baseSplitResult?.kind === "ready" ? baseSplitResult.rows : []
  const rows = splitResult?.kind === "ready" ? splitResult.rows : []
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(rows.length / SPLIT_PAGE_SIZE) - 1))
  const selectionRange = selected && request.calculationModel
    ? paceReferenceRange(createSegmentRecordReference("pace-tool-preview", selected, todayISO(), request.calculationModel)) : null
  const sourceLabel = selected ? `${selected.purpose === "RACE_GOAL" ? "저장한 목표 · 아직 달성하지 않음" : "저장한 경기 기록"} · ${selected.achievedOn ?? (selected.purpose === "RACE_GOAL" ? "미래 목표" : "날짜 미입력")}` : "이번 계산에만 입력 · 저장되지 않음"
  const titles: Record<PaceToolStage, string> = { event: "어떤 종목의 기록인가요?", input: `${paceEventLabel(event)} 기록을 입력해 주세요`, result: "내 기록으로 페이스 계산",
    reference: "어떤 기록을 기준으로 볼까요?", splits: "구간별 통과 시간", table: "비슷한 페이스 비교", track: "트랙 안내", evidence: "이 숫자는 어떻게 나왔나요?" }

  return <section className="pace-tool" aria-label="페이스 계산">
    <header className="pace-tool__header"><button type="button" onClick={onBack} aria-label="이전 단계" title="이전 단계"><ArrowLeft size={20} /></button>
      <span>오라클 · 페이스 계산</span>
      <button type="button" onClick={closeTool} aria-label="페이스 도구 닫기" title="페이스 도구 닫기"><X size={18} /></button></header>
    <TaskGuide as="h1" ref={heading} tabIndex={-1} title={titles[stage]}
      description={stage === "event" ? "기록으로 거리별 평균 시간을 계산해요." : undefined}
      illustration={stage === "event" ? "pace-stopwatch" : undefined} />
    {message && <p role="status">{message}</p>}
    {stage === "event" && <>
      <button type="button" onClick={openRecords}>저장한 경기 기록 사용 <ArrowRight size={18} aria-hidden="true" /></button>
      <h2 id="pace-direct-event">직접 입력할 종목</h2>
      <div className="pace-tool__choices app-choice-group" role="group" aria-labelledby="pace-direct-event">{PACE_EVENT_METERS.map(distance => <button className="app-choice-control app-choice-control--answer" key={distance} type="button"
        onClick={() => chooseEvent(distance)}>{paceEventLabel(distance)}<ArrowRight size={18} /></button>)}</div>
    </>}
    {stage === "input" && <form onSubmit={e => { e.preventDefault(); if (total !== null) onStageChange("result") }}>
      <div className="pace-tool__clock">{([ ["hours", "시간"], ["minutes", "분"], ["seconds", "초"] ] as const).map(([key, label]) => <label key={key}>
        <input aria-label={label} type="text" inputMode={key === "seconds" ? "decimal" : "numeric"} value={fields[key]}
          onChange={e => setField(key, e.target.value)} placeholder="0" />{label}</label>)}</div>
      {parsed.kind === "invalid" && <p role="alert">{parsed.message}</p>}
      <button type="submit" className="pace-tool__primary" disabled={total === null}>페이스 보기 <ArrowRight size={18} /></button>
      <button type="button" onClick={openRecords}>저장한 경기 기록 사용</button>
    </form>}
    {stage === "reference" && <>
      {!records.length && <p>저장한 경기 기록이 없어요. 기록을 직접 입력해 계산할 수 있어요.</p>}
      {PACE_EVENT_METERS.filter(distance => !request.onSelectRecord || !request.allowedEvents || request.allowedEvents.includes(distance)).map(distance => {
        const group = derivePaceRecordOptions(records, distance, todayISO())
        if (!group.options.length) return null
        return <section className="pace-tool__record-group" key={distance}><h2>{paceEventLabel(distance)}</h2>
          {group.latestStatus === "AMBIGUOUS" && <p>같은 날 기록이 여러 개예요. 사용할 기록을 골라 주세요.</p>}
          {group.options.map(option => <button className="pace-tool__record" key={option.sourceSnapshot.id} type="button" onClick={() => chooseRecord(option.sourceSnapshot)}>
            <strong>{paceClock(option.sourceSnapshot.performanceSeconds)}{option.sourceSnapshot.id === group.recommendedRecordId && <small>추천</small>}</strong>
            <span>{option.badges.map(badge => BADGES[badge]).join(" · ")} · {option.sourceSnapshot.achievedOn ?? (option.sourceSnapshot.purpose === "RACE_GOAL" ? "목표" : "날짜 미입력")}</span>
          </button>)}</section>
      })}
      <button type="button" onClick={() => onStageChange("event")}>다른 기록 직접 입력</button>
    </>}
    {stage !== "event" && stage !== "reference" && stage !== "input" && <>
      {total === null ? <><p role="status">기록을 입력하면 결과를 볼 수 있어요.</p><button type="button" onClick={() => onStageChange("input")}>기록 입력</button></> : <>
        <div className="pace-tool__source"><strong>{paceEventLabel(event)} · {paceClock(total)}</strong><span>{sourceLabel}</span>
          <button type="button" onClick={openRecords}>기준 바꾸기</button>
          <button type="button" onClick={() => onStageChange("input")}>직접 수정</button></div>
        {stale && <p role="status">저장된 기록이 바뀌었어요. 계산은 비교용으로 볼 수 있지만 훈련에 연결하려면 다시 선택해 주세요.</p>}
        {stage === "result" && <>
          <dl className="pace-tool__results" aria-live="polite">{primaryPaceDistances(event).map(distance => <div key={distance}><dt>{paceEventLabel(distance)}</dt>
            <dd>{paceClock(directPaceSeconds(total, event, distance)!)}</dd></div>)}</dl>
          <p className="pace-tool__caption">경기 평균 속도로 달렸을 때의 시간</p>
          {request.onSelectRecord && <section className="pace-tool__selection"><h2>{request.selectionLabel ?? "이 훈련의 기준"}</h2>
            {selectionRange && <p>{paceClock(selectionRange.minimum, 0)}{selectionRange.maximum !== selectionRange.minimum ? `~${paceClock(selectionRange.maximum, 0)}` : ""}/km · {request.calculationModel === "FIVE_K_THRESHOLD_V1" ? "5km 기록 기반 LT 참고 범위" : "경기 평균 페이스"}</p>}
            <button type="button" className="pace-tool__primary" disabled={!canSelect} onClick={() => {
              if (selected && isEligiblePaceRecordCurrent(selected)) {
                if (request.onSelectRecord?.(selected) === false) setMessage("수정 중인 훈련이 바뀌었어요. 이전 화면에서 다시 확인해 주세요.")
              } else setMessage("기록을 다시 선택해 주세요.")
            }}>이 기준으로 훈련 확인 <ArrowRight size={18} /></button>
            {!selected && <p>훈련에 연결하려면 저장한 경기 기록을 골라 주세요.</p>}
          </section>}
          <div className="pace-tool__tools">{([ ["splits", ListOrdered, "구간 시간"], ["table", Table2, "페이스 표"], ["track", Flag, "트랙 안내"], ["evidence", HelpCircle, "계산 근거"] ] as const).map(([destination, Icon, label]) =>
            <button key={destination} type="button" onClick={() => onStageChange(destination)}><Icon size={20} />
              <span className="pace-tool__tool-copy"><span>{label}</span>{destination === "track" && <small>레인 계산은 아직 준비 중이에요</small>}</span>
              <ArrowRight size={16} /></button>)}</div>
        </>}
        {stage === "splits" && <>
          <div className="pace-tool__split-controls"><label>구간 거리(m)<input type="text" inputMode="decimal" value={unit} onChange={e => setUnit(e.target.value)} /></label>
            <label>배분<select value={trend} onChange={e => setTrend(e.target.value as typeof trend)}><option value="even">같은 페이스</option><option value="faster">후반을 빠르게</option><option value="slower">후반을 느리게</option></select></label></div>
          {splitResult?.kind === "invalid" && <p role="alert">{splitResult.message}</p>}
          {rows.length > 0 && <><p className="pace-tool__caption">{rows.length}구간 · 합계 {paceClock(total)}{trend !== "even" ? " · 비교용 시간 배분" : ""}</p>
            <table><thead><tr><th scope="col">누적 거리</th><th scope="col">구간 시간</th><th scope="col">통과 시간</th></tr></thead><tbody>
              {rows.slice(visiblePage * SPLIT_PAGE_SIZE, (visiblePage + 1) * SPLIT_PAGE_SIZE).map((row, offset) => {
                const index = visiblePage * SPLIT_PAGE_SIZE + offset
                return <tr key={row.cumulativeMetres}><th scope="row">{row.cumulativeMetres}m</th><td>{paceClock(row.seconds)}
                  <button type="button" className="pace-tool__lock" title={row.fixed ? "구간 시간 고정 해제" : "이 구간 시간 고정"} aria-label={`${index + 1}구간 ${row.fixed ? "고정 해제" : "시간 고정"}`} onClick={() => {
                    const values = { ...fixedValues }
                    if (row.fixed) delete values[index]
                    else values[index] = String(row.seconds)
                    setFixed({ source: splitSource, values })
                  }}>{row.fixed ? <LockKeyhole size={16} /> : <UnlockKeyhole size={16} />}</button></td><td>{paceClock(row.cumulativeSeconds)}</td></tr>
              })}</tbody></table>
            {rows.length > SPLIT_PAGE_SIZE && <nav className="pace-tool__pagination" aria-label="구간 표 페이지"><button type="button" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)} aria-label="이전 구간"><ArrowLeft size={20} /></button>
              <span>{visiblePage + 1} / {Math.ceil(rows.length / SPLIT_PAGE_SIZE)}</span><button type="button" disabled={(visiblePage + 1) * SPLIT_PAGE_SIZE >= rows.length} onClick={() => setPage(visiblePage + 1)} aria-label="다음 구간"><ArrowRight size={20} /></button></nav>}
          </>}
          {Object.entries(fixedValues).length > 0 && <section className="pace-tool__fixed"><h2>고정할 구간 시간</h2>
            {Object.entries(fixedValues).map(([index, value]) => <label key={index}>{Number(index) + 1}구간 · {baseRows[Number(index)]?.metres}m
              <input type="text" inputMode="decimal" aria-label={`${Number(index) + 1}구간 고정 초`} value={value} onChange={e => setFixed({ source: splitSource, values: { ...fixedValues, [index]: e.target.value } })} />초
            </label>)}
            <button type="button" onClick={() => setFixed({ source: splitSource, values: {} })}>고정 모두 해제</button>
          </section>}
        </>}
        {stage === "table" && <><p className="pace-tool__caption">현재 기록의 평균 페이스 ±5·10초/km · 훈련 강도 추천이 아니에요.</p><table><thead><tr><th scope="col">/km</th><th scope="col">200m</th><th scope="col">400m</th><th scope="col">{paceEventLabel(event)}</th></tr></thead><tbody>
          {nearbyPaceTable(total, event).map(row => <tr key={row.offset} data-current={row.offset === 0}><th scope="row">{paceClock(row.secondsPerKm, 0)}</th><td>{paceClock(row.seconds200)}</td><td>{paceClock(row.seconds400)}</td><td>{paceClock(row.eventSeconds)}</td></tr>)}</tbody></table></>}
        {stage === "track" && <><p>트랙 1바퀴와 출발선이 같은 레인 주행은 거리 기준이 달라요.</p><p>레인·장애물 경기 계산은 공식 시설 기준 확인 후 제공할 예정이에요. 현재는 임의의 거리값을 쓰지 않아요.</p></>}
        {stage === "evidence" && <><h2>기록의 평균 속도를 환산해요</h2>
          <p>400m = <strong>{paceClock(directPaceSeconds(total, event, 400)!)}</strong> <small>(분:초 · 반올림 표시)</small></p>
          <p>반복 횟수와 휴식은 이 계산에 들어가지 않아요. 짧은 구간을 이 속도로 반복할 수 있다는 뜻은 아니에요.</p>
          <details><summary>계산식·정밀한 값</summary>
            <p>구간 시간 = 경기 기록 초 × 구간 거리 ÷ 경기 거리</p>
            <p>{total}초 × 400m ÷ {event}m = {directPaceSeconds(total, event, 400)}초</p>
          </details>
          {request.calculationModel === "FIVE_K_THRESHOLD_V1" && <p>훈련의 LT 참고 범위는 기존 5km 전용 모델로 별도 계산해요. 위 평균 속도 표와 같지 않으며 측정한 개인 역치가 아니에요.</p>}
          <p>목표는 현재 실력과 구분해요. 하프 계산 거리는 21,097.5m예요. 표시는 마지막에 반올림하며 구간 합계는 전체 기록에 맞춰요.</p></>}
      </>}
    </>}
    <footer className="pace-tool__footer"><Calculator size={16} /><span>계산 미리보기 · 기록·계획 변경 없음</span></footer>
  </section>
}
