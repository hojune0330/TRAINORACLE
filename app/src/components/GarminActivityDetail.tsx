import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react"
import { activeLocalAccount, journalOwner, localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { accountJournalDocumentId } from "../domain/account/account-journal-record-service"
import { garminErrorMessage, requestGarminIntegration, type GarminError, type GarminItem, type GarminSample, type GarminTransport } from "../domain/account/garmin-integration"
import { garminChartSamples, loadGarminActivitySamples } from "../domain/account/garmin-activity-detail"
import { GARMIN_SUMMARY_METRICS } from "../domain/account/garmin-summary"
import { ImportedActivitySensorChart } from "./ImportedActivitySensorChart"
import { ImportedActivityRoute } from "./ImportedActivityRoute"
import { activityDistance, activityDuration, activityPace, importedSourceClock, originalQuantity } from "./ImportedActivityMetrics"
import { RecordAction, RecordNotice, RecordSource } from "./RecordUI"
import { AccessibleTrendTable } from "../screens/trends/AccessibleTrendTable"
import "./imported-activity-detail.css"

const views = ["개요", "구간", "그래프"] as const
const meaning = { TIMER: "타이머 시간", MOVING: "이동 시간", ELAPSED: "경과 시간", UNKNOWN: "시간 종류 미확인" }
const sport = { RUNNING: "달리기", WALKING: "걷기", CYCLING: "자전거", OTHER: "기타 운동", UNKNOWN: "운동 종류 미확인" }
type Props = { readonly ownerId: string; readonly transport?: GarminTransport } & ({ readonly item: GarminItem; readonly documentId?: never } | { readonly documentId: string; readonly item?: never })

export function GarminActivityDetail(props: Props) {
  const generation = useSyncExternalStore(onLocalJournalScopeChange, localJournalScopeGeneration, () => 0)
  return <ProviderDetailSession key={`${props.ownerId}:${generation}:${props.documentId ?? `${props.item.inboxId}:${props.item.revision}:${props.item.state}`}`} {...props} />
}
function ProviderDetailSession({ ownerId, item: initialItem, documentId, transport = requestGarminIntegration }: Props) {
  const [item, setItem] = useState<GarminItem | null>(initialItem ?? null), [samples, setSamples] = useState<GarminSample[] | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState<GarminError | null>(null), [progress, setProgress] = useState("")
  const [view, setView] = useState(0), [lapCount, setLapCount] = useState(20), [positionStart, setPositionStart] = useState(0)
  const titleId = useId(), active = useRef(true), operation = useRef<AbortController | null>(null)
  const chartSamples = useMemo(() => item && samples ? garminChartSamples(item, samples) : [], [item, samples])
  const current = (controller: AbortController) => active.current && operation.current === controller && !controller.signal.aborted
  useEffect(() => { active.current = true; return () => { active.current = false; operation.current?.abort() } }, [])
  async function read() {
    operation.current?.abort(); const controller = new AbortController(); operation.current = controller; setBusy(true); setError(null)
    try {
      let record = initialItem ?? null
      if (documentId) {
        const result = await transport(ownerId, { action: "read", documentId }, controller.signal, () => current(controller))
        if (!current(controller)) return
        if (!result.ok) { setError(result.code); return }
        if (!("item" in result.data) || result.data.item.documentId !== documentId) { setError("INVALID_RESPONSE"); return }
        record = result.data.item
        // A changed provider source is not the exact snapshot already written in the journal.
        if (record.state !== "CONFIRMED") { setError("SOURCE_CHANGED"); setItem(null); return }
        setItem(record)
      }
      if (!record) { setError("INVALID_RESPONSE"); return }
      const result = await loadGarminActivitySamples(ownerId, record, controller.signal, () => current(controller), transport,
        (loaded, total) => { if (current(controller)) setProgress(`센서 자료 ${total}묶음 중 ${loaded}묶음 확인`) })
      if (!current(controller)) return
      if (!result.ok) { setError(result.code); setSamples(null); return }
      setSamples(result.samples)
    } catch { if (current(controller)) { setError("UNAVAILABLE"); setSamples(null) } }
    finally { if (current(controller)) setBusy(false) }
  }
  useEffect(() => { void read() }, []) // keyed by owner, scope and exact source revision
  const tabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === "ArrowRight" ? (index + 1) % views.length : event.key === "ArrowLeft" ? (index + views.length - 1) % views.length : event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : null
    if (next === null) return
    event.preventDefault(); setView(next); document.getElementById(`${titleId}-${next}`)?.focus()
  }
  const observation = item?.observation
  const summary = item?.source?.summary
  const positions = samples?.flatMap((sample, index) => Object.hasOwn(sample, "latitude") || Object.hasOwn(sample, "longitude") ? [{ sample, index }] : []) ?? []
  const sensorChart = observation ? <>
        {samples === null && !error ? <p>센서 자료를 확인하고 있어요.</p> : samples !== null ? <ImportedActivitySensorChart samples={chartSamples} range={null} onClearRange={() => {}}
          markers={item?.source?.lapStartOffsetsSeconds.flatMap((offset, index) => { const instant = Date.parse(observation.startedAt) + offset * 1000; return Number.isFinite(instant) && Math.abs(instant) <= 8640000000000000 ? [{ timestamp: new Date(instant).toISOString(), label: `원본 구간 ${index + 1} 시작 · 운동 시작 뒤 ${offset}초` }] : [] })}
          timeDescription="시각은 원본 운동 시작에 제공된 표본의 경과 초를 더해 UTC로 표시해요. 원본 경과 초와 값은 표에 유지해요. 빈 값을 이어 붙이거나 걸음 수를 환산하지 않아요."
          sampleClock={sample => `운동 시작 뒤 ${samples[sample.sourceIndex]!.offsetSeconds}초 · ${sample.timestamp ? importedSourceClock(sample.timestamp) : "시각 범위 확인 불가"}`} /> : null}
  </> : null
  return <section className="imported-activity-detail garmin-detail record-ui" aria-labelledby={titleId} aria-busy={busy || undefined}>
    <h3 id={titleId}>운동 상세</h3>
    {busy && <p role="status">운동 자료 확인 중…</p>}
    {error && <RecordAction priority="secondary" disabled={busy} onClick={() => void read()}>다시 불러오기</RecordAction>}
    {busy && progress && <p role="status">{progress}</p>}
    {error && <RecordNotice kind="error" title="원본 확인을 완료하지 못했어요" announce><p>{garminErrorMessage[error]}</p></RecordNotice>}
    {observation && <>
      <p>{sport[observation.sport]} · {importedSourceClock(observation.startedAt)} · Garmin</p>
      {item?.state !== "CONFIRMED" && <p>일지에 저장되지 않은 기록</p>}
      <dl className="garmin-detail__metrics garmin-detail__hero">
        <div><dt>거리</dt><dd>{activityDistance(observation.distanceMeters)}</dd></div>
        <div><dt>{meaning[observation.durationMeaning]}</dt><dd>{activityDuration(observation.durationSeconds)}</dd></div>
        {typeof summary?.averagePaceInMinutesPerKilometer === "number" && <div><dt>평균 페이스 · 원본</dt><dd>{activityPace(summary.averagePaceInMinutesPerKilometer)}</dd></div>}
      </dl>
      {(item?.source?.parent.isParent || item?.source?.parent.parentSummaryId) && <RecordNotice kind="conflict" title="복합운동 기록이에요"><p>상위 기록과 하위 기록을 함께 저장하면 운동량이 중복될 수 있어요.</p></RecordNotice>}
      {item?.source?.manual && <p>Garmin에서 수동 입력된 운동이에요.</p>}

      <div className="imported-activity-detail__tabs" role="tablist" aria-label="Garmin 운동 상세 보기">
        {views.map((label, index) => <button key={label} type="button" role="tab" id={`${titleId}-${index}`} className="app-choice-control" aria-selected={view === index} aria-controls={`${titleId}-panel-${index}`} tabIndex={view === index ? 0 : -1}
          onKeyDown={event => tabKey(event, index)} onClick={() => setView(index)}>{label}</button>)}
      </div>
      <div id={`${titleId}-panel-0`} role="tabpanel" aria-labelledby={`${titleId}-0`} hidden={view !== 0}>
        <dl className="garmin-detail__metrics">{(Object.keys(GARMIN_SUMMARY_METRICS) as (keyof typeof GARMIN_SUMMARY_METRICS)[])
          .filter(field => !["startingLatitudeInDegree", "startingLongitudeInDegree", "averagePaceInMinutesPerKilometer"].includes(field) && typeof summary?.[field] === "number")
          .map(field => <div key={field}><dt>{GARMIN_SUMMARY_METRICS[field][0]}</dt><dd>{originalQuantity(summary![field]!, GARMIN_SUMMARY_METRICS[field][1])}</dd></div>)}</dl>
        {view === 0 && <>{sensorChart}
          {chartSamples.some(sample => sample.position !== null) && <ImportedActivityRoute samples={chartSamples} />}

    </>}
      </div>
      <div id={`${titleId}-panel-1`} role="tabpanel" aria-labelledby={`${titleId}-1`} hidden={view !== 1}>
        <h4>원본 구간 {observation.laps.length}개</h4>
        <p>원본 순서를 유지해요. 구간 종료 시각이 제공되지 않아 구간별 차트 범위를 새로 계산하지 않아요.</p>
        {!!item?.source?.lapStartOffsetsSeconds.length && <details><summary>원본 구간 시작 표시</summary><p>{item.source.lapStartOffsetsSeconds.slice(0, lapCount).map((offset, index) => `${index + 1}구간: 운동 시작 뒤 ${offset}초`).join(" · ")}</p>
          {lapCount < item.source.lapStartOffsetsSeconds.length && <RecordAction priority="secondary" onClick={() => setLapCount(value => value + 20)}>시작 표시 20개 더 보기</RecordAction>}</details>}
        {observation.laps.length ? <table className="imported-activity-detail__table"><caption>Garmin이 전달한 구간 기록</caption><thead><tr><th scope="col">구간</th><th scope="col">거리</th><th scope="col">원본 시간</th></tr></thead><tbody>{observation.laps.slice(0, lapCount).map((lap, index) => <tr key={index}><th scope="row">{index + 1}</th><td>{originalQuantity(lap.distanceMeters, "m")}</td><td>{originalQuantity(lap.durationSeconds, "s")}<small>{meaning[lap.durationMeaning]}</small></td></tr>)}</tbody></table> : <p>받은 구간 기록이 없어요.</p>}
        {lapCount < observation.laps.length && <RecordAction priority="secondary" onClick={() => setLapCount(value => value + 20)}>구간 20개 더 보기</RecordAction>}
      </div>
      <div id={`${titleId}-panel-2`} role="tabpanel" aria-labelledby={`${titleId}-2`} hidden={view !== 2}>
        {view === 2 && sensorChart}
      </div>
          <details className="garmin-detail__raw"><summary>기록 정보와 원본 수치</summary>
        <RecordSource source="Garmin 계정에서 받음" dateBasis={item?.clock ? "기기 표시 날짜 · 기기 설정 시차" : observation.timeZone} originalTimeMeaning={meaning[observation.durationMeaning]} />
        <dl className="imported-activity-detail__context">
          <div><dt>운동 시작</dt><dd>{importedSourceClock(observation.startedAt)}</dd></div>
          {item?.clock && <div><dt>기기 표시 날짜</dt><dd>{item.clock.localDate} · 기기 설정 시차 {item.clock.offsetSeconds}초</dd></div>}
          <div><dt>운동 종류</dt><dd>{sport[observation.sport]}</dd></div>
          <div><dt>전달 경로</dt><dd>Garmin 계정 연결</dd></div>
          {item?.source && <><div><dt>원본 기록 방식</dt><dd>{item.source.manual ? "Garmin에서 수동 입력" : "수동 입력 표시 없음"}</dd></div>
            <div><dt>복합운동 관계</dt><dd>{item.source.parent.isParent ? "여러 운동을 묶은 상위 기록" : item.source.parent.parentSummaryId ? "복합운동의 하위 기록" : "상위·하위 관계 표시 없음"}</dd></div></>}
          <div><dt>기기 이름</dt><dd>{summary && Object.hasOwn(summary, "deviceName") ? summary.deviceName === null ? "원본 빈값(null)" : summary.deviceName === "" ? "원본 빈 문자열" : summary.deviceName : "현재 보관된 기기 이름이 없어요."}</dd></div>
          <div><dt>자료 상태</dt><dd>{item?.state === "CONFIRMED" ? "계정 일지에 반영된 원본" : "받은 원본 · 일지 저장과 별도"}</dd></div>
        </dl>
        {item?.clock && <p>기기에 설정된 시차는 실제 지역 시간대를 확정하는 정보가 아니에요. 원본 시작 시각과 따로 표시해요.</p>}

        <table className="imported-activity-detail__table"><caption>Garmin 원본 요약 수치 · 보관 여부 포함</caption>
          <thead><tr><th scope="col">항목</th><th scope="col">원본 값</th><th scope="col">단위</th></tr></thead>
          <tbody>{(Object.keys(GARMIN_SUMMARY_METRICS) as (keyof typeof GARMIN_SUMMARY_METRICS)[]).map(field => {
            const [label, unit] = GARMIN_SUMMARY_METRICS[field], present = summary && Object.hasOwn(summary, field), value = summary?.[field]
            return <tr key={field}><th scope="row">{label}<small>{field}</small></th><td>{!present ? "보관된 값 없음" : value === null ? "원본 빈값(null)" : String(value)}</td><td>{unit}</td></tr>
          })}</tbody></table>
        <p>보관된 값 없음은 전달 누락과 현재 수집 허용 범위를 구별해 확정한 상태가 아니에요. 아래 표는 원본 단위와 정밀도예요. 위 요약의 거리는 km, 시간과 페이스는 읽기 쉬운 형식으로 표시해요.</p>
        {positions.length > 0 && <><AccessibleTrendTable caption="원본 위치 표본" rows={positions.slice(positionStart, positionStart + 20).map(({ sample, index }) => ({ key: String(index), label: `표본 ${index + 1} · 시작 뒤 ${sample.offsetSeconds}초`, value: `위도 ${originalQuantity(sample.latitude, "°")} · 경도 ${originalQuantity(sample.longitude, "°")}` }))} />
          <p>위치 표본 {positions.length}개 중 {positionStart + 1}–{Math.min(positionStart + 20, positions.length)}개</p>
          {positions.length > 20 && <div className="imported-activity-detail__pager"><RecordAction priority="secondary" disabled={positionStart === 0} onClick={() => setPositionStart(value => Math.max(0, value - 20))}>이전 위치 표본</RecordAction><RecordAction priority="secondary" disabled={positionStart + 20 >= positions.length} onClick={() => setPositionStart(value => value + 20)}>다음 위치 표본</RecordAction></div>}</>}
      </details>
    </>}
  </section>
}

/** Exact account document ID; a local provenance string alone never grants a server read. */
export function GarminJournalActivityDetail({ entryId, durationMissing = false }: { readonly entryId: string; readonly durationMissing?: boolean }) {
  return <GarminJournalDetailIdentity entryId={entryId} durationMissing={durationMissing} />
}
function GarminJournalDetailIdentity({ entryId, durationMissing }: { readonly entryId: string; readonly durationMissing: boolean }) {
  const generation = useSyncExternalStore(onLocalJournalScopeChange, localJournalScopeGeneration, () => 0)
  const owner = activeLocalAccount(), [identity, setIdentity] = useState<{ owner: string; generation: number; entryId: string; documentId: string } | null>(null)
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    setFailed(false)
    if (owner && journalOwner(entryId) === owner) void accountJournalDocumentId(owner, entryId).then(documentId => {
      if (live && activeLocalAccount() === owner && localJournalScopeGeneration() === generation) setIdentity({ owner, generation, entryId, documentId })
    }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [owner, generation, entryId, attempt])
  return identity && identity.owner === owner && identity.generation === generation && identity.entryId === entryId
    ? <GarminJournalPreview key={`${owner}:${generation}:${identity.documentId}`} ownerId={identity.owner} documentId={identity.documentId} durationMissing={durationMissing} />
    : !owner || journalOwner(entryId) !== owner ? <p>이 기록을 보관한 계정에서 확인해 주세요.</p>
      : failed ? <RecordNotice kind="error" title="운동 상세를 불러오지 못했어요"><RecordAction onClick={() => setAttempt(value => value + 1)}>다시 불러오기</RecordAction></RecordNotice>
        : <p role="status">운동 상세를 확인하고 있어요.</p>
}

/** Read the verified summary once; fetch sensor parts only when the reader opens it. */
export function GarminJournalPreview({ ownerId, documentId, durationMissing, transport = requestGarminIntegration }: {
  readonly ownerId: string; readonly documentId: string; readonly durationMissing: boolean; readonly transport?: GarminTransport
}) {
  const [item, setItem] = useState<GarminItem | null>(null), [error, setError] = useState<GarminError | null>(null)
  const [open, setOpen] = useState(false), [attempt, setAttempt] = useState(0)
  const details = useRef<HTMLDetailsElement | null>(null), detailTitle = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const controller = new AbortController(), generation = localJournalScopeGeneration()
    const current = () => !controller.signal.aborted && activeLocalAccount() === ownerId && localJournalScopeGeneration() === generation
    const unsubscribe = onLocalJournalScopeChange(() => controller.abort())
    setItem(null); setError(null)
    void transport(ownerId, { action: "read", documentId, experience: true }, controller.signal, current).then(result => {
      if (!current()) return
      if (!result.ok) { setError(result.code); return }
      if (!("item" in result.data) || result.data.item.documentId !== documentId) { setError("INVALID_RESPONSE"); return }
      if (result.data.item.state !== "CONFIRMED") { setError("SOURCE_CHANGED"); return }
      setItem(result.data.item)
    }).catch(() => { if (current()) setError("UNAVAILABLE") })
    return () => { controller.abort(); unsubscribe() }
  }, [ownerId, documentId, transport, attempt])
  const unknown = durationMissing && item?.savedAutomatically === true && item.observation?.durationMeaning === "UNKNOWN" && item.observation.durationSeconds !== null
  return <div className="garmin-journal-preview">
    {unknown && <RecordNotice kind="pending" title="시간 기준 확인 필요">
      <p>Garmin 원본 시간은 {activityDuration(item.observation!.durationSeconds)}예요. 이동·정지 포함 기준이 확인되지 않아 일지 시간과 페이스 계산에는 넣지 않았어요.</p>
      {!open && <RecordAction priority="secondary" onClick={() => { setOpen(true); if (details.current) details.current.open = true; requestAnimationFrame(() => detailTitle.current?.focus({ preventScroll: true })) }}>Garmin 원본 시간 보기</RecordAction>}
    </RecordNotice>}
    {error && <RecordNotice kind="error" title="원본 확인을 완료하지 못했어요"><p>{garminErrorMessage[error]}</p><RecordAction priority="secondary" onClick={() => setAttempt(value => value + 1)}>다시 불러오기</RecordAction></RecordNotice>}
    {!item && !error && <p role="status">운동 원본을 확인하고 있어요.</p>}
    {item && <details ref={details} className="garmin-detail__raw" open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary ref={detailTitle} tabIndex={0}>운동 상세</summary>
      {open && <GarminActivityDetail ownerId={ownerId} item={item} transport={transport} />}
    </details>}
  </div>
}
