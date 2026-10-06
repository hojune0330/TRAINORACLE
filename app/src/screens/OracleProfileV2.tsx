import React from "react"
import { OracleProfileExperience, OracleProfileReader } from "./OracleProfileExperience"
import { createOracleV2Service, oracleV2EditToken, type OracleV2Store } from "../domain/account/account-oracle-v2-service"
import { activeLocalAccount } from "../domain/account/local-journal-ownership"
import { makeOracleProfileRevision, saveOracleProfileReading } from "../domain/oracle-profile-snapshot"
import { buildOracleContentReading } from "../domain/oracle-content-reader"
import type { OracleAxisId, OracleResponses } from "../domain/oracle-profile-v2"
import type { OracleDestination } from "../domain/oracle-content-catalog"
import { useAthleteRecordsSnapshot } from "../hooks/useAthleteRecordsSnapshot"
import { registerUnsavedDraftGuard } from "../domain/unsaved-draft-navigation"
import { usePlanEvidenceHistory } from "../hooks/usePlanEvidenceHistory"
import { buildOracleContentAdapter, oracleContentCalendarPeriods } from "../domain/oracle-content-adapter"
import { loadEntriesForPlanSafety } from "../domain/journal-store"
import { readPlanBetaStateFromStorage } from "../domain/plan-beta-store"
import { accountPlansEnabled, accountPlanService } from "../domain/account/account-plan-service"
import { isoShift } from "../domain/dates"
import { OracleContextEditor } from "./OracleContextEditor"
import type { OracleProfileContext } from "../domain/oracle-profile-context"
import { emptyOracleV2Document } from "../domain/account/account-oracle-v2-schema"
import { OracleFriendComparisonV2 } from "./OracleFriendComparisonV2"
import { OracleLinkedDestination, canEmbedOracleDestination } from "./OracleLinkedDestination"
import { OracleConnectedComparison } from "./OracleConnectedComparison"
import { runningProfileDocumentId } from "../domain/account/account-running-profile-service"
import { useOracleReadingSources } from "../hooks/useOracleReadingSources"

const initial: OracleV2Store = { status: "LOADING", document: null, legacyDocument: null, revision: 0,
  sequence: 0, remote: null, remoteRevision: null, error: null }

/** Not publicly enabled until the complete V2 release gate is satisfied. */
export type GuestOracleSession = {
  readonly ownerKey: "guest"
  readonly answers: OracleResponses
  readonly selectedCharacter: OracleAxisId | null
  readonly context?: OracleProfileContext
}

export function OracleProfileV2({ today, onBack, onNavigate, initialView = "result", backLabel, guestSession, onGuestSessionChange }: {
  today: string; onBack: () => void; onNavigate: (destination: OracleDestination) => void
  initialView?: "result" | "library"
  backLabel?: string
  guestSession?: GuestOracleSession | null
  onGuestSessionChange?: (session: GuestOracleSession | null) => void
}) {
  const owner = activeLocalAccount()
  return <OracleProfileV2ForOwner key={owner ?? "guest"} owner={owner} today={today} onBack={onBack} onNavigate={onNavigate} initialView={initialView} backLabel={backLabel} guestSession={guestSession} onGuestSessionChange={onGuestSessionChange} />
}

function OracleProfileV2ForOwner({ owner, today, onBack, onNavigate, initialView, backLabel, guestSession, onGuestSessionChange }: {
  owner: string | null; today: string; onBack: () => void; onNavigate: (destination: OracleDestination) => void
  initialView: "result" | "library"; backLabel?: string; guestSession?: GuestOracleSession | null; onGuestSessionChange?: (session: GuestOracleSession | null) => void
}) {
  const [store, setStore] = React.useState(initial)
  const [resetVersion, setResetVersion] = React.useState(0)
  const [localGuestSession, setLocalGuestSession] = React.useState<GuestOracleSession | null>(null)
  const [notice, setNotice] = React.useState("")
  const [contextOpen, setContextOpen] = React.useState(false)
  const [contextDraft, setContextDraft] = React.useState<OracleProfileContext>()
  const scopedGuestSession = !owner
    ? guestSession === undefined ? localGuestSession : guestSession?.ownerKey === "guest" ? guestSession : null
    : null
  const guest = scopedGuestSession?.answers ?? {}
  const guestCharacter = scopedGuestSession?.selectedCharacter ?? null
  const setGuestSession = (session: GuestOracleSession | null) => {
    if (owner) return
    setLocalGuestSession(session)
    onGuestSessionChange?.(session)
  }
  const invited = /^[A-Za-z0-9_-]{43}$/u.test(new URLSearchParams(window.location.hash.slice(1)).get("oracle-compare-invite") ?? "")
  const [friendsOpen, setFriendsOpen] = React.useState(invited)
  const [friendMode, setFriendMode] = React.useState<"choose" | "connected" | "manual">(invited ? "connected" : "choose")
  const [documentId, setDocumentId] = React.useState<string | null>(null)
  const [linkedDestination, setLinkedDestination] = React.useState<OracleDestination | null>(null)
  const [selectedGoalId, setSelectedGoalId] = React.useState<string | null>(null)
  const service = React.useRef<ReturnType<typeof createOracleV2Service> | null>(null)
  const work = React.useRef<Promise<unknown>>(Promise.resolve())
  const unsafe = React.useRef(false)
  const scoreUnsafe = React.useRef(false)
  const records = useAthleteRecordsSnapshot()
  React.useEffect(() => {
    let alive = true
    if (owner) void runningProfileDocumentId(owner).then(id => { if (alive) setDocumentId(id) }).catch(() => { if (alive) setDocumentId(null) })
    return () => { alive = false }
  }, [owner])
  React.useEffect(() => { if (store.status === "DELETED") { setContextDraft(undefined); setContextOpen(false); setFriendsOpen(false); unsafe.current = false; scoreUnsafe.current = false } }, [store.status])
  const evidence = usePlanEvidenceHistory(true)
  const sources = useOracleReadingSources(today)
  const journal = loadEntriesForPlanSafety()
  const plan = readPlanBetaStateFromStorage()
  const planReady = !owner || accountPlansEnabled() && accountPlanService()?.snapshot().status === "READY"
  const data = buildOracleContentAdapter({ today,
    fileLaps: sources.fileLaps, catalogMethod: sources.catalogMethod,
    journal: evidence.journalReadComplete && journal.status === "complete" ? { state: "READY", sourceVersion: "JOURNAL_STRUCTURED_V1", data: {
      entries: journal.entries, period: { startDate: isoShift(today, -55), endDate: today }, coverage: "PARTIAL",
    } } : { state: "UNAVAILABLE" },
    plan: planReady && plan.kind === "loaded" ? { state: "READY", sourceVersion: `PLAN_V${plan.state.version}`, data: plan.state } : { state: "UNAVAILABLE" },
    planHistory: evidence.history.kind === "loaded" ? { state: "READY", sourceVersion: "PLAN_HISTORY_V1", data: evidence.history.plans } : { state: "UNAVAILABLE" },
  })
  const previousData = buildOracleContentAdapter({ today,
    journal: evidence.journalReadComplete && journal.status === "complete" ? { state: "READY", sourceVersion: "JOURNAL_STRUCTURED_V1", data: {
      entries: journal.entries, period: { startDate: isoShift(today, -111), endDate: isoShift(today, -56) }, coverage: "PARTIAL",
    } } : { state: "UNAVAILABLE" },
  })
  const goals = records.records.filter(record => record.purpose === "RACE_GOAL")
  const goal = goals.find(item => item.id === selectedGoalId) ?? (goals.length === 1 ? goals[0] : undefined)
  React.useEffect(() => {
    if (!owner) return
    let alive = true
    const next = createOracleV2Service(owner, state => { if (alive) setStore(state) })
    service.current = next
    void next.hydrate()
    const retry = () => { if (alive && !unsafe.current) void next.hydrate() }
    window.addEventListener("online", retry)
    return () => { alive = false; window.removeEventListener("online", retry); next.close(); service.current = null }
  }, [owner])
  React.useEffect(() => {
    const stop = registerUnsavedDraftGuard({ isUnsafe: () => unsafe.current,
      onBlocked: () => setNotice("계정에 저장하지 않은 응답이 있어요."),
      confirmDiscard: () => window.confirm("저장하지 않은 응답을 지우고 나갈까요?"),
      discard: () => { unsafe.current = false } })
    const unload = (event: BeforeUnloadEvent) => { if (unsafe.current) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", unload)
    return () => { stop(); window.removeEventListener("beforeunload", unload) }
  }, [])
  const enqueue = (action: (current: ReturnType<typeof createOracleV2Service>) => Promise<boolean>) => {
    const captured = service.current
    const next = work.current.catch(() => undefined).then(async () => {
      if (!captured || captured !== service.current || activeLocalAccount() !== owner) return false
      return action(captured)
    }).catch(() => false)
    work.current = next
    return next
  }
  const current = store.confirmedDocument?.data.current
  const profileReadable = !owner || store.status === "EMPTY" || (["READY", "PENDING"].includes(store.status) && Boolean(store.confirmedDocument))
  const unavailableProfile = { state: store.status === "DELETED" ? "REVOKED" as const : "UNAVAILABLE" as const }
  const context = owner ? store.confirmedDocument?.data.context : scopedGuestSession?.context
  const contextEditing = Boolean(contextDraft || store.draftDocument?.data.context && JSON.stringify(store.draftDocument.data.context) !== JSON.stringify(context))
  const hasScoreDraft = Boolean(store.draftDocument?.data.current && JSON.stringify(store.draftDocument.data.current) !== JSON.stringify(current ?? null))
  React.useEffect(() => { if (hasScoreDraft || contextEditing) unsafe.current = true }, [hasScoreDraft, contextEditing])
  const resolveConflict = async (choice: "LOCAL" | "REMOTE") => {
    const ok = await enqueue(next => next.resolve(store, choice))
    if (ok) { setContextDraft(undefined); scoreUnsafe.current = false; unsafe.current = false; setResetVersion(value => value + 1); setNotice("") }
    else setNotice("응답을 반영하지 못했어요. 연결을 확인하고 다시 시도해 주세요.")
  }
  const comparisonProfile = React.useMemo(() => owner ? current ?? null : Object.keys(guest).length ? makeOracleProfileRevision({ revision: 1, answeredAt: new Date().toISOString(), answers: guest, selectedCharacter: guestCharacter }) : null, [owner, current, guest, guestCharacter])
  const commit = async (answers: OracleResponses, character: OracleAxisId | null) => {
    if (!owner) { setGuestSession({ ownerKey: "guest", answers, selectedCharacter: character, ...(context ? { context } : {}) }); scoreUnsafe.current = false; unsafe.current = contextEditing; return true }
    const ok = await enqueue(next => next.commitAnswers(answers, character, oracleV2EditToken(next.snapshot())))
    scoreUnsafe.current = !ok; unsafe.current = !ok || contextEditing
    if (!ok) setNotice("계정 저장이 끝나지 않았어요. 응답은 그대로 두고 다시 확인해 주세요.")
    else setNotice("")
    return ok
  }
  const status = store.status === "EMPTY" ? "READY" : ["MIGRATION_REQUIRED", "LEGACY_DRAFT"].includes(store.status) ? "LOADING" : store.status
  return <>
    {store.status === "DELETED" && <section className="oracle-v2 oracle-v2__body"><p>이전 응답은 삭제됐어요. 새 질문에 답해 다시 시작할 수 있어요.</p><button type="button" onClick={() => { void enqueue(next => next.restartProfile(oracleV2EditToken(next.snapshot()), "START_NEW_ORACLE_V2")).then(ok => { if (!ok) setNotice("새 프로필을 시작하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.") }) }}>빈 프로필로 새로 시작</button></section>}
    {store.status === "MIGRATION_REQUIRED" && <section className="oracle-v2 oracle-v2__body"><h2>이전 응답을 보관하고 새 프로필 시작</h2><p>기존 답은 그대로 보관해요. 새 점수는 새 질문에 답한 내용으로만 계산해요.</p><button type="button" onClick={() => { void enqueue(next => next.migrateV1(oracleV2EditToken(next.snapshot()))) }}>이전 응답 보관하고 시작</button></section>}
    {store.status === "LEGACY_DRAFT" && <p role="alert">이전 화면에 아직 계정으로 보내지 않은 응답이 있어요. 기존 프로필에서 먼저 저장해 주세요.</p>}
    {store.status === "CONFLICT" && <section className="oracle-v2 oracle-v2__body"><p role="alert">다른 곳에서 응답이 바뀌었어요. 어떤 응답을 사용할까요?</p><button type="button" onClick={() => { void resolveConflict("REMOTE") }}>계정의 응답 사용</button><button type="button" onClick={() => { void resolveConflict("LOCAL") }}>이 화면의 응답 사용</button></section>}
    <OracleProfileExperience key={resetVersion} initialView={initialView} backLabel={backLabel} answers={owner ? current?.answers ?? {} : guest}
      draftAnswers={owner ? store.draftDocument?.data.current?.answers : undefined}
      selectedCharacter={owner ? current?.selectedCharacter ?? null : guestCharacter}
      revision={current?.revision ?? 0} readings={owner ? store.confirmedDocument?.data.readings ?? [] : []}
      account={owner !== null} status={status as "LOADING" | "READY" | "PENDING" | "CONFLICT" | "FAILED" | "DELETED"}
      message={notice || (owner && store.status === "EMPTY" ? "아직 계정에 저장한 응답이 없어요." : undefined)} onBack={onBack}
      onNavigate={destination => { if (destination === "FRIENDS" || destination === "SHARE_PREVIEW") setFriendsOpen(true); else if (canEmbedOracleDestination(destination)) setLinkedDestination(destination); else onNavigate(destination) }}
      responsesDisabled={contextEditing}
      hasPendingScore={hasScoreDraft} draftState={store.draftState}
      onContext={() => { if (scoreUnsafe.current || hasScoreDraft) { setNotice("작성하던 3문항을 먼저 마치면 추가 응답을 열 수 있어요."); return } setContextOpen(true) }}
      onDraft={answers => { scoreUnsafe.current = true; unsafe.current = true; if (owner) void enqueue(next => next.saveDraft(answers, oracleV2EditToken(next.snapshot()))) }}
      onCommit={commit}
      onRetry={() => { void enqueue(next => next.hydrate()) }}
      onRemember={() => enqueue(async next => {
        const snapshot = next.snapshot(), document = snapshot.document
        if (snapshot.status !== "READY" || !document?.data.current) return false
        if (document.data.readings.some(item => item.source.revision === document.data.current!.revision)) return true
        const updated = structuredClone(document)
        updated.data.readings.push(saveOracleProfileReading(document.data.current, new Date().toISOString()))
        return next.save(updated, oracleV2EditToken(snapshot))
      })}
      onDelete={async () => { if (!owner) { setGuestSession(null); setContextDraft(undefined); unsafe.current = false; scoreUnsafe.current = false; return true }
        const ok = await enqueue(next => next.deleteProfile(oracleV2EditToken(next.snapshot()))); if (ok) { unsafe.current = false; scoreUnsafe.current = false }; return ok }}
      renderTopicControls={id => <>
        {["B04", "F02", "F08"].includes(id) && sources.fileOptions.length > 0 && <label>어느 운동의 구간을 볼까요?
          <select value={sources.selectedFileKey ?? ""} onChange={event => sources.setSelectedFileKey(event.target.value || null)}>
            <option value="">기록 선택</option>{sources.fileOptions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select></label>}
        {["D01", "D06"].includes(id) && sources.methodOptions.length > 0 && <label>어느 훈련을 살펴볼까요?
          <select value={sources.selectedMethodKey ?? ""} onChange={event => sources.setSelectedMethodKey(event.target.value || null)}>
            <option value="">계획의 훈련 선택</option>{sources.methodOptions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select></label>}
        {id === "B06" && goals.length > 1 && <label>비교할 목표 기록
          <select value={selectedGoalId ?? ""} onChange={event => setSelectedGoalId(event.target.value || null)}>
            <option value="">목표 선택</option>{goals.map(item => <option key={item.id} value={item.id}>{item.eventDistanceM}m · {item.performanceSeconds}초</option>)}
          </select></label>}
      </>}
      readTopic={(id, answers) => {
        const confirmedAnswers = owner ? current?.answers ?? {} : answers
        const period = id === "G01" ? oracleContentCalendarPeriods(today).currentMonth : id === "G06" && sources.cyclePeriod.state === "READY" ? sources.cyclePeriod.data : null
        const scoped = period ? buildOracleContentAdapter({ today, journal: evidence.journalReadComplete && journal.status === "complete"
          ? { state: "READY", sourceVersion: "JOURNAL_STRUCTURED_V1", data: { entries: journal.entries, period, coverage: "PARTIAL" } }
          : { state: "UNAVAILABLE" }, plan: planReady && plan.kind === "loaded" ? { state: "READY", sourceVersion: `PLAN_V${plan.state.version}`, data: plan.state } : { state: "UNAVAILABLE" },
          planHistory: evidence.history.kind === "loaded" ? { state: "READY", sourceVersion: "PLAN_HISTORY_V1", data: evidence.history.plans } : { state: "UNAVAILABLE" } }) : data
        const result = buildOracleContentReading(id, { today,
          training: id === "G06" && !period ? { state: sources.cyclePeriod.state === "UNAVAILABLE" ? "UNAVAILABLE" : "MISSING" } : scoped.training,
          previousTraining: previousData.training, planActual: id === "G06" && !period ? { state: "MISSING" } : scoped.planActual,
          laps: data.laps, method: data.method,
          goal: records.status !== "READY" ? { state: "UNAVAILABLE" } : goal ? { state: "READY", sourceVersion: "ATHLETE_RECORDS_GOAL", data: { eventDistanceM: goal.eventDistanceM, performanceSeconds: goal.performanceSeconds } } : { state: "MISSING" },
          answers: !profileReadable ? unavailableProfile : context ? { state: "READY", sourceVersion: context.version, data: context.answers } : { state: "MISSING" },
          conditions: !profileReadable ? unavailableProfile : context ? { state: "READY", sourceVersion: context.version, data: context.conditions } : { state: "MISSING" },
          previousProfile: !profileReadable ? unavailableProfile : owner && store.confirmedDocument?.data.readings.filter(item => item.source.revision < (current?.revision ?? 0)).sort((a, b) => b.source.revision - a.source.revision)[0]
            ? { state: "READY", sourceVersion: "ORACLE_PROFILE_REVISION_V2", data: store.confirmedDocument!.data.readings.filter(item => item.source.revision < current!.revision).sort((a, b) => b.source.revision - a.source.revision)[0]!.source } : { state: "MISSING" },
          profile: !profileReadable ? unavailableProfile : Object.keys(confirmedAnswers).length ? { state: "READY", sourceVersion: "ORACLE_PROFILE_REVISION_V2", data: makeOracleProfileRevision({ revision: current?.revision ?? 1, answeredAt: current?.answeredAt ?? new Date().toISOString(), answers: confirmedAnswers }) } : { state: "MISSING" },
          records: records.status === "READY" ? { state: "READY", sourceVersion: "ATHLETE_RECORDS", data: records.records } : { state: "UNAVAILABLE" },
        })
        return { state: result.kind === "EDUCATION" ? "EDUCATION" : result.status === "SUFFICIENT" ? "READY" : result.status,
          facts: result.facts.map(fact => ({ label: fact.label, value: `${typeof fact.value === "number" ? new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(fact.value) : fact.value}${["category", "answer", "date"].includes(fact.unit) ? "" : ` ${({ count: "개", days: "일", s: "초", min: "분", index: fact.metric === "M05" ? "· 속도 지수" : "점 · 내 응답", reps: "회", sets: "세트", "s/200m": "초 / 200m", "s/400m": "초 / 400m", "s/km": "초 / km" } as Record<string, string>)[fact.unit] ?? fact.unit}`}`,
            source: [fact.period ? `${fact.period.startDate} ~ ${fact.period.endDate}` : [...new Set(fact.sourceRefs.map(ref => ref.date ?? "입력한 자료"))].join(" · "), ...(fact.denominator === undefined ? [] : [fact.unit === "index" ? fact.metric === "M01" ? `${fact.denominator}점 만점 · 내 응답` : `기준 ${fact.denominator}` : `확인한 ${fact.denominator}개 기준`])].join(" · ") })),
          paragraphs: result.paragraphs, limitations: result.limitations, evidence: result }
      }} />
    {contextOpen && <OracleContextEditor initial={contextDraft ?? store.draftDocument?.data.context ?? context} records={records.status === "READY" ? records.records : null}
      onClose={() => setContextOpen(false)} onDraft={draft => { setContextDraft(draft); unsafe.current = true
        if (owner) void enqueue(next => { const snapshot = next.snapshot(); if (snapshot.draftDocument?.data.current && JSON.stringify(snapshot.draftDocument.data.current) !== JSON.stringify(snapshot.confirmedDocument?.data.current ?? null)) return Promise.resolve(false); const document = structuredClone(snapshot.confirmedDocument ?? emptyOracleV2Document()); document.data.context = draft; return next.saveDraft(document, oracleV2EditToken(snapshot)) })
      }}
      onSave={async draft => {
        if (!owner) { setGuestSession({ ownerKey: "guest", answers: guest, selectedCharacter: guestCharacter, context: draft }); setContextDraft(undefined); unsafe.current = false; return true }
        const ok = await enqueue(next => { const snapshot = next.snapshot(); if (snapshot.draftDocument?.data.current && JSON.stringify(snapshot.draftDocument.data.current) !== JSON.stringify(snapshot.confirmedDocument?.data.current ?? null)) return Promise.resolve(false); const document = structuredClone(snapshot.confirmedDocument ?? emptyOracleV2Document()); document.data.context = draft; return next.save(document, oracleV2EditToken(snapshot)) })
        if (ok) { unsafe.current = false; setContextDraft(undefined) }
        return ok
      }} />}
    {friendsOpen && <OracleProfileReader title="친구와 함께 살펴보기" onClose={() => setFriendsOpen(false)} closeLabel={null}>
      {close => friendMode === "manual" ? <OracleFriendComparisonV2 today={today} ownProfile={comparisonProfile} records={records.status === "READY" ? records.records : null} onBack={() => setFriendMode("choose")} />
        : friendMode === "connected" && owner && documentId && current && store.status === "READY" && !hasScoreDraft
          ? <OracleConnectedComparison ownerId={owner} documentId={documentId} documentRevision={store.revision} ownProfile={current} onBack={() => setFriendMode("choose")} />
          : <section className="oracle-v2__choices" aria-label="비교 방법">
            <h2>어떻게 비교할까요?</h2>
            <button type="button" disabled={!owner || !documentId || !current || store.status !== "READY" || hasScoreDraft} onClick={() => setFriendMode("connected")}>친구 초대로 응답 비교</button>
            {(!owner || !current) && <p>초대 비교는 내 응답을 계정에 저장한 뒤 할 수 있어요.</p>}
            {owner && current && (store.status !== "READY" || hasScoreDraft) && <p role="status">내 응답 저장을 먼저 마쳐 주세요.</p>}
            <button type="button" onClick={() => setFriendMode("manual")}>직접 입력해서 비교</button>
            <p>직접 입력은 이 화면에서만 보는 비교예요. 친구 계정과 연결되지 않아요.</p>
            <button type="button" onClick={close}>풀이로 돌아가기</button>
          </section>}
    </OracleProfileReader>}
    {linkedDestination && <OracleProfileReader title="풀이와 연결된 내용" onClose={() => setLinkedDestination(null)} closeLabel={null}>
      {close => <OracleLinkedDestination destination={linkedDestination} today={today} onBack={close} />}
    </OracleProfileReader>}
  </>
}
