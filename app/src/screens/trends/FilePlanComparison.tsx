import React from "react"
import { Columns2, Link2, RefreshCw, Unlink, X } from "lucide-react"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import { FILE_WRITE_REJECTION_MESSAGES } from "../../domain/account/account-write-rejection"
import { accountPlanService } from "../../domain/account/account-plan-service"
import { readCurrentConfirmedAccountJournalProjection } from "../../domain/account/account-journal-projection"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { confirmAccountJournalComparison, releaseAccountJournalComparison, retryAccountJournalComparison,
  readAccountJournalWriteBase, type AccountJournalWriteBase } from "../../domain/account/account-journal-record-service"
import { projectFileObservation, type ProjectedFileObservation } from "../../domain/import/file-analysis"
import { loadComparisonPlanChoices, resolveAccountComparisonOriginal, type ComparisonPlanChoice } from "../../domain/import/comparison-plan-source"
import { compareFileToPlan, comparePreviousFilePerformance, comparisonObservationInterpretationFingerprint,
  type ComparisonOriginalResolution, type ComparisonPlanSegment } from "../../domain/import/file-plan-comparison"
import { parseComparisonRelation, type ComparisonRelationV1, type ComparisonSegmentMapping } from "../../domain/import/comparison-relation"
import { readPersistedComparisonReadContext } from "../../domain/import/comparison-relation-read"
import { fileDuration, fileNumber, signedFileDifference } from "./file-analysis-display"

const PHASE = { warmup: "준비", main: "본운동", cooldown: "정리" } as const
const RECOVERY = { WALK: "걷기", JOG: "조깅", STAND: "멈춰 쉬기", WALK_OR_JOG: "걷기 또는 조깅", WALK_OR_STAND: "걷거나 멈춰 쉬기", ACTIVE_ROLL_ON: "가볍게 이어가기" } as const
const MEANING = { TIMER: "기록 시간 · 일시정지 제외", MOVING: "이동 시간", ELAPSED: "전체 경과 시간" } as const
const LIMITATION: Record<string, string> = { RECOVERY_MODE_UNKNOWN_OR_DIFFERENT: "실제 회복 방법 확인 필요", TIME_MEANING_NOT_TIMER: "기록 시간인지 확인 필요", MISSING_DISTANCE: "거리 없음", MISSING_DURATION: "시간 없음" }
const sameSession = (relation: ComparisonRelationV1, choice: ComparisonPlanChoice) => relation.original.planFingerprint === choice.reference.planFingerprint
  && relation.original.session.plannedSessionId === choice.reference.session.plannedSessionId
function relations(base: AccountJournalWriteBase | null): ComparisonRelationV1[] {
  if (base?.entry?.kind !== "post-session") return []
  return (base.entry.comparisonRelations ?? []).flatMap(value => { const relation = parseComparisonRelation(value); return relation ? [relation] : [] })
}
function segmentLabel(segment: ComparisonPlanSegment, index: number) {
  return `${index + 1}. ${PHASE[segment.phase]} ${segment.kind === "RECOVERY" ? "회복" : "운동"} · ${segment.targetUnit === "DISTANCE" ? `${fileNumber(segment.distanceMeters ?? 0)}m` : fileDuration(segment.durationSeconds)}`
}
function choiceLabel(choice: ComparisonPlanChoice) {
  const ref = choice.reference.session
  const made = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(choice.generatedAt))
  return `${ref.plannedDate} ${ref.sessionSlot === "AM" ? "오전" : "오후"} · ${ref.plannedRole === "QUALITY" ? "주요 훈련" : "기초·회복 훈련"} · 작성 ${made}${choice.archivedAt ? " · 이전 계획" : ""}`
}
type PreviousResult = ReturnType<typeof comparePreviousFilePerformance>
type Captured = { readonly base: AccountJournalWriteBase; readonly observation: ProjectedFileObservation }

export function FilePlanComparison({ entryId }: { readonly entryId: string }) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [captured, setCaptured] = React.useState<Captured | null>(null)
  const [choices, setChoices] = React.useState<readonly ComparisonPlanChoice[]>([])
  const [selected, setSelected] = React.useState("")
  const [original, setOriginal] = React.useState<ComparisonOriginalResolution | null>(null)
  const [relation, setRelation] = React.useState<ComparisonRelationV1 | null>(null)
  const [mapping, setMapping] = React.useState<Record<string, ComparisonSegmentMapping>>({})
  const [limit, setLimit] = React.useState(20)
  const [message, setMessage] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [previous, setPrevious] = React.useState<PreviousResult | null>(null)
  const epoch = React.useRef(0)
  React.useEffect(() => {
    const reset = () => { epoch.current++; setOpen(false); setBusy(false); setCaptured(null); setChoices([]); setOriginal(null); setRelation(null); setMapping({}); setPrevious(null); setMessage(""); setPending(false) }
    const unsubscribe = onLocalJournalScopeChange(reset)
    return () => { epoch.current++; unsubscribe() }
  }, [])
  const readCurrent = async () => {
    const base = await readAccountJournalWriteBase(entryId)
    if (!base?.entry || base.revision < 1) return null
    const projection = projectFileObservation(base.entry, { sourceContext: "ACCOUNT_CONFIRMED" })
    return projection.status === "ACCEPTED" ? { base, observation: projection.observation } : null
  }
  const start = async () => {
    if (pending && captured) { setOpen(true); return }
    const run = ++epoch.current
    setOpen(true); setBusy(true); setMessage("")
    setCaptured(null); setChoices([]); setSelected(""); setOriginal(null); setRelation(null); setMapping({}); setPrevious(null)
    try {
      const current = await readCurrent()
      if (run !== epoch.current) return
      setCaptured(current)
      if (!current) { setMessage("계정에 저장된 운동 기록을 먼저 확인해 주세요."); return }
      const service = accountPlanService()
      if (service) await service.hydrate()
      if (run !== epoch.current) return
      const loaded = await loadComparisonPlanChoices()
      if (run !== epoch.current) return
      setChoices(loaded.choices)
      if (loaded.status !== "AVAILABLE" || loaded.choices.length === 0) setMessage("계정에 저장된 원래 계획을 찾지 못했어요. 파일 구간은 확인할 수 있지만 계획과의 비교는 저장하지 않아요.")
      setSelected(""); setOriginal(null); setRelation(null); setMapping({}); setPrevious(null)
    } catch { if (run === epoch.current) setMessage("계획 원본을 불러오지 못했어요. 기존 기록은 바뀌지 않았어요.") }
    finally { if (run === epoch.current) setBusy(false) }
  }
  const select = async (choiceId: string) => {
    const run = ++epoch.current, choice = choices.find(value => value.choiceId === choiceId)
    setSelected(choiceId); setMapping({}); setOriginal(null); setRelation(null); setPrevious(null); setMessage(""); setLimit(20)
    if (!choice || !captured) return
    setBusy(true)
    try {
      const prior = relations(captured.base).reverse().find(item => item.releasedAt === null && sameSession(item, choice)) ?? null
      const result = await resolveAccountComparisonOriginal(prior?.original ?? choice.reference)
      if (run !== epoch.current) return
      setOriginal(result); setRelation(prior)
      if (result.status !== "ORIGINAL_VERIFIED") setMessage("원래 계획을 확인하지 못했어요. 현재 계획으로 바꾸어 비교하지 않아요.")
      else if (result.limitation) setMessage("이 계획에는 확인 가능한 상세 구간이 없어 구간 차이를 계산하지 않아요.")
    } catch { if (run === epoch.current) setMessage("계획 원본을 불러오지 못했어요.") }
    finally { if (run === epoch.current) setBusy(false) }
  }
  const comparison = original && captured ? compareFileToPlan(original, captured.observation, relation, captured.base.revision,
    relation ? readPersistedComparisonReadContext(entryId, relation.relationId) : null) : null
  const segments = original?.status === "ORIGINAL_VERIFIED" ? original.segments : []
  const setLap = (segment: ComparisonPlanSegment, value: string) => {
    setMapping(prior => {
      const next = { ...prior }
      if (value === "") delete next[segment.id]
      else next[segment.id] = { planSegmentId: segment.id, sourceLapIndex: Number(value), confirmedKind: segment.kind,
        confirmedTargetUnit: segment.targetUnit, confirmedDurationMeaning: null, confirmedRecoveryMode: null }
      return next
    })
  }
  const patchMapping = (id: string, patch: Partial<ComparisonSegmentMapping>) => setMapping(prior => prior[id] ? { ...prior, [id]: { ...prior[id], ...patch } } : prior)
  const store = async (action: "CONFIRM" | "RELEASE" | "RETRY") => {
    if (!captured || action === "CONFIRM" && original?.status !== "ORIGINAL_VERIFIED") return
    const reference = original?.status === "ORIGINAL_VERIFIED" ? original.original : relation?.original
    if (!reference || action === "RELEASE" && !relation) return
    const run = ++epoch.current
    setBusy(true); setMessage("")
    try {
      const next: ComparisonRelationV1 = { schemaVersion: 1, relationId: crypto.randomUUID(), journalId: entryId,
        journalRevisionAtConfirmation: captured.base.revision, contentRevisionFingerprint: captured.observation.contentRevisionFingerprint,
        observationInterpretationFingerprint: comparisonObservationInterpretationFingerprint(captured.observation),
        original: reference, mappingVersion: 1, mappingConfirmation: "USER_CONFIRMED",
        segmentMappings: segments.flatMap(segment => mapping[segment.id] ? [mapping[segment.id]!] : []),
        createdAt: new Date().toISOString(), releasedAt: null }
      if (action === "CONFIRM" && original && compareFileToPlan(original, captured.observation, next, captured.base.revision).status !== "QUANTITATIVE_COMPARISON") {
        setMessage("구간 순서와 운동·회복 종류를 다시 확인해 주세요. 같은 구간을 두 번 연결하거나 순서를 뒤집을 수 없어요."); return
      }
      const result = action === "RETRY" ? await retryAccountJournalComparison(entryId)
        : action === "RELEASE" && relation ? await releaseAccountJournalComparison(entryId, relation.relationId, captured.base)
          : await confirmAccountJournalComparison(entryId, next, captured.base)
      if (run !== epoch.current) return
      if (!result.ok) setMessage("rejection" in result && result.rejection in FILE_WRITE_REJECTION_MESSAGES
        ? FILE_WRITE_REJECTION_MESSAGES[result.rejection as keyof typeof FILE_WRITE_REJECTION_MESSAGES]
        : "비교를 저장하지 못했어요. 계정 연결과 최신 기록을 확인해 주세요. 기존 기록은 그대로예요.")
      else if (result.storage === "CONFLICT") setMessage("다른 곳에서 기록이 바뀌었어요. 덮어쓰지 않았어요. 기록을 다시 불러와 주세요.")
      else if (result.storage === "PENDING") { setPending(true); setMessage("비교 확인을 임시 보관했어요. 계정 저장은 아직 완료되지 않았어요.") }
      else {
        const current = await readCurrent()
        if (run !== epoch.current) return
        setCaptured(current); setPending(false); setMapping({}); setPrevious(null)
        const active = current ? relations(current.base).reverse().find(item => item.releasedAt === null
          && item.original.planFingerprint === reference.planFingerprint
          && item.original.session.plannedSessionId === reference.session.plannedSessionId) ?? null : null
        setRelation(active)
        if (active) {
          const reopened = await resolveAccountComparisonOriginal(active.original)
          if (run !== epoch.current) return
          setOriginal(reopened)
        }
        if (run === epoch.current) setMessage(action === "RELEASE" ? "비교 연결을 해제했어요. 운동 기록과 계획은 그대로예요." : "확인한 구간 비교를 계정에 저장했어요.")
      }
    } catch { if (run === epoch.current) setMessage("비교 저장 결과를 확인하지 못했어요. 기존 기록은 그대로 있어요.") }
    finally { if (run === epoch.current) setBusy(false) }
  }
  const previousChoices = readCurrentConfirmedAccountJournalProjection().flatMap(entry => entry.id !== entryId && entry.kind === "post-session" && entry.fileObservation
    ? (entry.comparisonRelations ?? []).flatMap((value, index) => {
      const prior = parseComparisonRelation(value)
      return prior && prior.releasedAt === null ? [{ key: JSON.stringify([entry.id, prior.relationId]), entryId: entry.id, relationId: prior.relationId,
        label: `${entry.date} · ${prior.original.session.sessionSlot === "AM" ? "오전" : "오후"} 계획 · 비교 ${index + 1}` }] : []
    }) : [])
  const comparePrevious = async (key: string) => {
    const run = ++epoch.current
    setPrevious(null)
    const choice = previousChoices.find(value => value.key === key)
    if (!choice || !captured || !original || !relation) return
    setBusy(true)
    try {
      const priorBase = await readAccountJournalWriteBase(choice.entryId)
      if (run !== epoch.current || !priorBase?.entry) return
      const projection = projectFileObservation(priorBase.entry, { sourceContext: "ACCOUNT_CONFIRMED" })
      const priorRelation = relations(priorBase).find(value => value.relationId === choice.relationId && value.releasedAt === null)
      if (projection.status !== "ACCEPTED" || !priorRelation) { setMessage("이전 운동에도 확인한 계획 구간 대응이 필요해요."); return }
      const priorOriginal = await resolveAccountComparisonOriginal(priorRelation.original)
      if (run !== epoch.current) return
      setPrevious(comparePreviousFilePerformance({ original, observation: captured.observation, relation, journalRevision: captured.base.revision,
        persistedReadContext: readPersistedComparisonReadContext(entryId, relation.relationId) },
        { original: priorOriginal, observation: projection.observation, relation: priorRelation, journalRevision: priorBase.revision,
          persistedReadContext: readPersistedComparisonReadContext(choice.entryId, priorRelation.relationId) }))
    } catch { if (run === epoch.current) setMessage("이전 기록을 확인하지 못했어요.") }
    finally { if (run === epoch.current) setBusy(false) }
  }
  if (!open) return <button type="button" onClick={() => void start()}><Columns2 size={16} aria-hidden="true" /> 계획과 비교</button>
  return <div className="file-plan-comparison file-observation-review" role="group" aria-label="계획과 실제 기록 비교">
    <div className="file-analysis-actions"><h3>계획과 실제 기록</h3><button type="button" aria-label="비교 닫기" disabled={busy} onClick={() => { epoch.current++; setOpen(false) }}><X size={18} /></button></div>
    <label>비교할 원래 훈련<select disabled={busy || pending} value={selected} onChange={event => void select(event.target.value)}>
      <option value="">훈련 선택</option>{choices.map(choice => <option key={choice.choiceId} value={choice.choiceId}>{choiceLabel(choice)}</option>)}
    </select></label>
    {captured && segments.length > 0 && comparison?.status !== "QUANTITATIVE_COMPARISON" && <>
      <p>{relation ? "이전에 확인한 비교가 현재 자료와 달라요. 변경된 구간을 다시 확인해 주세요." : "계획 구간과 실제 구간을 확인하기 전에는 차이를 계산하지 않아요."}</p>
      {segments.slice(0, limit).map((segment, index) => {
        const mapped = mapping[segment.id], lap = mapped ? captured.observation.laps[mapped.sourceLapIndex] : null
        return <fieldset key={segment.id} className="file-comparison-segment"><legend>{segmentLabel(segment, index)}</legend>
          {segment.recoveryMode && <p>계획 회복: {segment.recoveryMode === "FULL_RECOVERY" ? "충분한 회복" : segment.recoveryMode === "COACH_DEFINED" ? "개별 지정" : RECOVERY[segment.recoveryMode]}</p>}
          <label>대응하는 실제 구간<select disabled={busy || pending} value={mapped?.sourceLapIndex ?? ""} onChange={event => setLap(segment, event.target.value)}>
            <option value="">미대응</option>{captured.observation.laps.map(item => <option key={item.sourceIndex} value={item.sourceIndex}
              disabled={Object.values(mapping).some(value => value.planSegmentId !== segment.id && value.sourceLapIndex === item.sourceIndex)}>
              {item.sourceIndex + 1}번 · {item.distanceMeters === null ? "거리 미기록" : `${fileNumber(item.distanceMeters)}m`} · {fileDuration(item.durationSeconds)}
            </option>)}
          </select></label>
          {lap && (lap.durationMeaning === "UNKNOWN" || lap.durationMeaning === "SOURCE_DEFINED") && <label>이 구간의 시간
            <select disabled={busy || pending} value={mapped?.confirmedDurationMeaning ?? ""} onChange={event => patchMapping(segment.id, { confirmedDurationMeaning: (event.target.value || null) as ComparisonSegmentMapping["confirmedDurationMeaning"] })}>
              <option value="">모름 · 시간 차이 미계산</option>{Object.entries(MEANING).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>}
          {lap && segment.kind === "RECOVERY" && <label>실제 회복 방법<select disabled={busy || pending} value={mapped?.confirmedRecoveryMode ?? ""}
            onChange={event => patchMapping(segment.id, { confirmedRecoveryMode: (event.target.value || null) as ComparisonSegmentMapping["confirmedRecoveryMode"] })}>
            <option value="">확인하지 않음</option>{Object.entries(RECOVERY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>}
        </fieldset>
      })}
      {segments.length > limit && <button type="button" onClick={() => setLimit(value => value + 20)}>계획 구간 20개 더 보기</button>}
      <p>고른 구간이 위의 운동·회복에 해당하는지 확인해 주세요. 고르지 않은 구간은 비교에서 제외해요.</p>
      <button type="button" disabled={busy || pending || Object.keys(mapping).length === 0} onClick={() => void store("CONFIRM")}><Link2 size={16} aria-hidden="true" /> 선택한 대응 확인·저장</button>
    </>}
    {comparison?.status === "QUANTITATIVE_COMPARISON" && <>
      <div className="file-analysis-table" role="region" aria-label="계획과 실제 수치 차이" tabIndex={0}><table>
        <caption>실제 기록 − 계획값</caption><thead><tr><th>계획 / 실제</th><th>거리 차이</th><th>시간 차이</th><th>페이스 차이</th></tr></thead>
        <tbody>{comparison.rows.map(row => <tr key={row.planSegmentId}><th>{segments.findIndex(segment => segment.id === row.planSegmentId) + 1} / {row.sourceLapIndex + 1}</th>
          <td><span className="file-analysis-value">{signedFileDifference(row.delta.distanceMeters, "m")}</span></td><td><span className="file-analysis-value">{signedFileDifference(row.delta.durationSeconds, "초")}</span></td><td><span className="file-analysis-value">{signedFileDifference(row.delta.paceSecondsPerKm, "초/km")}</span></td></tr>)}</tbody>
      </table></div>
      <p>미대응: 계획 {comparison.unmatchedPlanSegmentIds.length}개 · 실제 {comparison.unmatchedSourceLapIndices.length}개</p>
      <InfoDisclosure title="계산하지 않은 항목과 해석 범위">
        {[...new Set(comparison.rows.flatMap(row => row.limitations))].map(reason => <p key={reason}>{LIMITATION[reason] ?? "구간 조건 확인 필요"}</p>)}
        <p>차이는 기록의 차이일 뿐 훈련 성공·실패 점수가 아니에요. 이 비교만으로 다음 훈련량이나 강도를 바꾸지 않아요.</p>
      </InfoDisclosure>
      <label>이전 수행과 비교<select disabled={busy || pending} defaultValue="" onChange={event => void comparePrevious(event.target.value)}><option value="">이전 운동 선택</option>
        {previousChoices.map(choice => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
      </select></label>
      {previous?.status === "PREVIOUS_COMPARISON_UNAVAILABLE" && <p>이전 기록과 훈련 구성·구간 대응·시간 또는 회복 조건이 달라 수치 차이를 계산하지 않았어요.</p>}
      {previous?.status === "PREVIOUS_QUANTITATIVE_COMPARISON" && <div className="file-analysis-table" role="region" aria-label="이전 수행과 수치 차이" tabIndex={0}><table>
        <caption>이번 수행 − 이전 수행 · 향상의 원인은 판정하지 않음</caption><thead><tr><th>이번 / 이전 구간</th><th>거리 차이</th><th>시간 차이</th><th>페이스 차이</th></tr></thead>
        <tbody>{previous.rows.map(row => <tr key={row.planSegmentId}><th>{row.currentSourceLapIndex + 1} / {row.previousSourceLapIndex + 1}</th>
          <td><span className="file-analysis-value">{signedFileDifference(row.delta.distanceMeters, "m")}</span></td><td><span className="file-analysis-value">{signedFileDifference(row.delta.durationSeconds, "초")}</span></td><td><span className="file-analysis-value">{signedFileDifference(row.delta.paceSecondsPerKm, "초/km")}</span></td></tr>)}</tbody>
      </table><p>날짜·계획 목표는 달라질 수 있어요. 날씨·노면·피로 차이는 이 파일만으로 알 수 없어요.</p></div>}
    </>}
    {relation && <button type="button" disabled={busy || pending} onClick={() => void store("RELEASE")}><Unlink size={16} aria-hidden="true" /> 이 비교 연결 해제</button>}
    {pending && <button type="button" disabled={busy} onClick={() => void store("RETRY")}><RefreshCw size={16} aria-hidden="true" /> 같은 비교 다시 전송</button>}
    <p role="status" aria-live="polite">{busy ? "계정에 저장된 원본을 확인하고 있어요." : message}</p>
  </div>
}
