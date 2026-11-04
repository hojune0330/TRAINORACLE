import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react"
import { activeLocalAccount, journalOwner, localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { accountJournalDocumentId } from "../domain/account/account-journal-record-service"
import { garminErrorMessage, requestGarminIntegration, type GarminError, type GarminItem, type GarminSample, type GarminTransport } from "../domain/account/garmin-integration"
import { garminChartSamples, loadGarminActivitySamples } from "../domain/account/garmin-activity-detail"
import { ImportedActivitySensorChart } from "./ImportedActivitySensorChart"
import { ImportedActivityRoute } from "./ImportedActivityRoute"
import { importedSourceClock, originalQuantity } from "./ImportedActivityMetrics"
import { RecordAction, RecordNotice, RecordSource } from "./RecordUI"
import { AccessibleTrendTable } from "../screens/trends/AccessibleTrendTable"
import "./imported-activity-detail.css"

const views = ["요약", "전체 수치", "구간", "차트"] as const
const meaning = { TIMER: "타이머 시간", MOVING: "이동 시간", ELAPSED: "경과 시간", UNKNOWN: "시간 종류 미확인" }
const sport = { RUNNING: "달리기", WALKING: "걷기", CYCLING: "자전거", OTHER: "기타 운동", UNKNOWN: "운동 종류 미확인" }
type Props = { readonly ownerId: string; readonly transport?: GarminTransport } & ({ readonly item: GarminItem; readonly documentId?: never } | { readonly documentId: string; readonly item?: never })

export function GarminActivityDetail(props: Props) {
  const generation = useSyncExternalStore(onLocalJournalScopeChange, localJournalScopeGeneration, () => 0)
  return <ProviderDetailSession key={`${props.ownerId}:${generation}:${props.documentId ?? `${props.item.inboxId}:${props.item.revision}`}`} {...props} />
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
  const tabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === "ArrowRight" ? (index + 1) % 4 : event.key === "ArrowLeft" ? (index + 3) % 4 : event.key === "Home" ? 0 : event.key === "End" ? 3 : null
    if (next === null) return
    event.preventDefault(); setView(next); document.getElementById(`${titleId}-${next}`)?.focus()
  }
  const observation = item?.observation
  const positions = samples?.flatMap((sample, index) => Object.hasOwn(sample, "latitude") || Object.hasOwn(sample, "longitude") ? [{ sample, index }] : []) ?? []
  return <section className="imported-activity-detail record-ui" aria-labelledby={titleId} aria-busy={busy || undefined}>
    <h3 id={titleId}>Garmin 원본 상세</h3>
    <p>계정으로 받은 원본을 읽어요. 이 화면을 여는 것으로 일지나 계획이 바뀌지는 않아요.</p>
    {samples === null && <RecordAction priority="secondary" disabled={busy} onClick={() => void read()}>{busy ? "원본 확인 중" : "보관된 원본 불러오기"}</RecordAction>}
    {busy && progress && <p role="status">{progress}</p>}
    {error && <RecordNotice kind="error" title="원본 확인을 완료하지 못했어요" announce><p>{garminErrorMessage[error]}</p></RecordNotice>}
    {observation && <>
      <div className="imported-activity-detail__tabs" role="tablist" aria-label="Garmin 운동 상세 보기">
        {views.map((label, index) => <button key={label} type="button" role="tab" id={`${titleId}-${index}`} className="app-choice-control" aria-selected={view === index} aria-controls={`${titleId}-panel-${index}`} tabIndex={view === index ? 0 : -1}
          onKeyDown={event => tabKey(event, index)} onClick={() => setView(index)}>{label}</button>)}
      </div>
      <div id={`${titleId}-panel-0`} role="tabpanel" aria-labelledby={`${titleId}-0`} hidden={view !== 0}>
        <RecordSource source="Garmin 계정에서 받음" dateBasis={item?.clock ? "기기 표시 날짜 · 기기 설정 시차" : observation.timeZone} originalTimeMeaning={meaning[observation.durationMeaning]} />
        <dl className="imported-activity-detail__context">
          <div><dt>운동 시작</dt><dd>{importedSourceClock(observation.startedAt)}</dd></div>
          {item?.clock && <div><dt>기기 표시 날짜</dt><dd>{item.clock.localDate} · 기기 설정 시차 {item.clock.offsetSeconds}초</dd></div>}
          <div><dt>운동 종류</dt><dd>{sport[observation.sport]}</dd></div>
          <div><dt>전달 경로</dt><dd>Garmin 계정 연결</dd></div>
          {item?.source && <><div><dt>원본 기록 방식</dt><dd>{item.source.manual ? "Garmin에서 수동 입력" : "수동 입력 표시 없음"}</dd></div>
            <div><dt>복합운동 관계</dt><dd>{item.source.parent.isParent ? "여러 운동을 묶은 상위 기록" : item.source.parent.parentSummaryId ? "복합운동의 하위 기록" : "상위·하위 관계 표시 없음"}</dd></div></>}
          <div><dt>기기 이름</dt><dd>이 받은 기록에는 제공되지 않았어요.</dd></div>
          <div><dt>자료 상태</dt><dd>{item?.state === "CONFIRMED" ? "계정 일지에 반영된 원본" : "받은 원본 · 일지 저장과 별도"}</dd></div>
        </dl>
        {item?.clock && <p>기기에 설정된 시차는 실제 지역 시간대를 확정하는 정보가 아니에요. 원본 시작 시각과 따로 표시해요.</p>}
        {(item?.source?.parent.isParent || item?.source?.parent.parentSummaryId) && <p>상위 기록과 하위 기록을 함께 저장하면 운동량이 중복될 수 있어요.</p>}
      </div>
      <div id={`${titleId}-panel-1`} role="tabpanel" aria-labelledby={`${titleId}-1`} hidden={view !== 1}>
        <h4>전달된 전체 수치</h4>
        <dl className="imported-activity-detail__context"><div><dt>거리</dt><dd>{originalQuantity(observation.distanceMeters, "m")}</dd></div>
          <div><dt>{meaning[observation.durationMeaning]}</dt><dd>{originalQuantity(observation.durationSeconds, "s")}</dd></div>
          <div><dt>구간</dt><dd>{observation.laps.length}개</dd></div><div><dt>센서 표본</dt><dd>{samples === null ? "아직 불러오지 않음" : `${samples.length}개`}</dd></div></dl>
        <p>제공되지 않은 평균·최대 수치와 페이스는 새로 만들지 않아요. 센서 값은 차트와 표에서 확인할 수 있어요.</p>
        {positions.length > 0 && <><AccessibleTrendTable caption="원본 위치 표본" rows={positions.slice(positionStart, positionStart + 20).map(({ sample, index }) => ({ key: String(index), label: `표본 ${index + 1} · 시작 뒤 ${sample.offsetSeconds}초`, value: `위도 ${originalQuantity(sample.latitude, "°")} · 경도 ${originalQuantity(sample.longitude, "°")}` }))} />
          <p>위치 표본 {positions.length}개 중 {positionStart + 1}–{Math.min(positionStart + 20, positions.length)}개</p>
          {positions.length > 20 && <div className="imported-activity-detail__pager"><RecordAction priority="secondary" disabled={positionStart === 0} onClick={() => setPositionStart(value => Math.max(0, value - 20))}>이전 위치 표본</RecordAction><RecordAction priority="secondary" disabled={positionStart + 20 >= positions.length} onClick={() => setPositionStart(value => value + 20)}>다음 위치 표본</RecordAction></div>}</>}
      </div>
      <div id={`${titleId}-panel-2`} role="tabpanel" aria-labelledby={`${titleId}-2`} hidden={view !== 2}>
        <h4>원본 구간 {observation.laps.length}개</h4>
        <p>원본 순서를 유지해요. 구간 종료 시각이 제공되지 않아 구간별 차트 범위를 새로 계산하지 않아요.</p>
        {!!item?.source?.lapStartOffsetsSeconds.length && <details><summary>원본 구간 시작 표시</summary><p>{item.source.lapStartOffsetsSeconds.slice(0, lapCount).map((offset, index) => `${index + 1}구간: 운동 시작 뒤 ${offset}초`).join(" · ")}</p>
          {lapCount < item.source.lapStartOffsetsSeconds.length && <RecordAction priority="secondary" onClick={() => setLapCount(value => value + 20)}>시작 표시 20개 더 보기</RecordAction>}</details>}
        {observation.laps.length ? <table className="imported-activity-detail__table"><caption>Garmin이 전달한 구간 기록</caption><thead><tr><th scope="col">구간</th><th scope="col">거리</th><th scope="col">원본 시간</th></tr></thead><tbody>{observation.laps.slice(0, lapCount).map((lap, index) => <tr key={index}><th scope="row">{index + 1}</th><td>{originalQuantity(lap.distanceMeters, "m")}</td><td>{originalQuantity(lap.durationSeconds, "s")}<small>{meaning[lap.durationMeaning]}</small></td></tr>)}</tbody></table> : <p>받은 구간 기록이 없어요.</p>}
        {lapCount < observation.laps.length && <RecordAction priority="secondary" onClick={() => setLapCount(value => value + 20)}>구간 20개 더 보기</RecordAction>}
      </div>
      <div id={`${titleId}-panel-3`} role="tabpanel" aria-labelledby={`${titleId}-3`} hidden={view !== 3}>
        {samples === null ? <p>보관된 원본을 불러오면 허용된 센서 표본을 확인할 수 있어요.</p> : <ImportedActivitySensorChart samples={chartSamples} range={null} onClearRange={() => {}}
          markers={item?.source?.lapStartOffsetsSeconds.flatMap((offset, index) => { const instant = Date.parse(observation.startedAt) + offset * 1000; return Number.isFinite(instant) && Math.abs(instant) <= 8640000000000000 ? [{ timestamp: new Date(instant).toISOString(), label: `원본 구간 ${index + 1} 시작 · 운동 시작 뒤 ${offset}초` }] : [] })}
          timeDescription="시각은 원본 운동 시작에 제공된 표본의 경과 초를 더해 UTC로 표시해요. 원본 경과 초와 값은 표에 유지해요. 빈 값을 이어 붙이거나 걸음 수를 환산하지 않아요."
          sampleClock={sample => `운동 시작 뒤 ${samples[sample.sourceIndex]!.offsetSeconds}초 · ${sample.timestamp ? importedSourceClock(sample.timestamp) : "시각 범위 확인 불가"}`} />}
        {samples && <ImportedActivityRoute samples={chartSamples} sampleClock={sample => `운동 시작 뒤 ${samples[sample.sourceIndex]!.offsetSeconds}초 · ${sample.timestamp ? importedSourceClock(sample.timestamp) : "시각 범위 확인 불가"}`} />}
      </div>
    </>}
  </section>
}

/** Exact account document ID; a local provenance string alone never grants a server read. */
export function GarminJournalActivityDetail({ entryId }: { readonly entryId: string }) {
  const generation = useSyncExternalStore(onLocalJournalScopeChange, localJournalScopeGeneration, () => 0)
  const owner = activeLocalAccount(), [identity, setIdentity] = useState<{ owner: string; generation: number; entryId: string; documentId: string } | null>(null)
  useEffect(() => {
    let live = true
    if (owner && journalOwner(entryId) === owner) void accountJournalDocumentId(owner, entryId).then(documentId => {
      if (live && activeLocalAccount() === owner && localJournalScopeGeneration() === generation) setIdentity({ owner, generation, entryId, documentId })
    })
    return () => { live = false }
  }, [owner, generation, entryId])
  return identity && identity.owner === owner && identity.generation === generation && identity.entryId === entryId
    ? <GarminActivityDetail ownerId={identity.owner} documentId={identity.documentId} /> : null
}
