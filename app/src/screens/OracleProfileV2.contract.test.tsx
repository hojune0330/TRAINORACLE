import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { OracleProfileV2 } from "./OracleProfileV2"
import { createOracleV2Service, oracleV2EditToken, type OracleV2Store } from "../domain/account/account-oracle-v2-service"
import { activeLocalAccount } from "../domain/account/local-journal-ownership"
import { accountOracleV2DocumentSchema, emptyOracleV2Document, type AccountOracleV2Document } from "../domain/account/account-oracle-v2-schema"
import { makeOracleProfileRevision, saveOracleProfileReading } from "../domain/oracle-profile-snapshot"
import { ORACLE_AXES, ORACLE_QUESTIONS, type OracleAxisId, type OracleResponses } from "../domain/oracle-profile-v2"
import { buildOracleContentReading } from "../domain/oracle-content-reader"

const readerMode = vi.hoisted(() => ({ native: false }))
const recordSource = vi.hoisted(() => ({ records: [] as import("../domain/athlete-records").AthleteRecord[] }))
vi.mock("../domain/oracle-content-reader", async importOriginal => {
  const actual = await importOriginal<typeof import("../domain/oracle-content-reader")>()
  return { ...actual, buildOracleContentReading: vi.fn(actual.buildOracleContentReading) }
})
vi.mock("../domain/account/account-oracle-v2-service", async importOriginal => ({
  ...await importOriginal<typeof import("../domain/account/account-oracle-v2-service")>(),
  createOracleV2Service: vi.fn(),
}))
vi.mock("../domain/account/local-journal-ownership", () => ({ activeLocalAccount: vi.fn() }))
vi.mock("../hooks/useAthleteRecordsSnapshot", () => ({ useAthleteRecordsSnapshot: () => ({ status: "READY", records: recordSource.records }) }))
vi.mock("../hooks/useOracleReadingSources", () => ({ useOracleReadingSources: (): import("../hooks/useOracleReadingSources").OracleReadingSources => ({
  fileOptions: [], methodOptions: [], selectedFileKey: null, selectedMethodKey: null,
  setSelectedFileKey: () => {}, setSelectedMethodKey: () => {},
  fileLaps: { state: "MISSING" }, catalogMethod: { state: "MISSING" }, cyclePeriod: { state: "MISSING" },
}) }))
vi.mock("../hooks/usePlanEvidenceHistory", () => ({ usePlanEvidenceHistory: () => ({ journalReadComplete: false, history: { kind: "unavailable" } }) }))
vi.mock("../domain/journal-store", () => ({ loadEntriesForPlanSafety: () => ({ status: "unavailable" }) }))
vi.mock("../domain/plan-beta-store", () => ({ readPlanBetaStateFromStorage: () => ({ kind: "empty" }) }))
vi.mock("../domain/account/account-plan-service", () => ({ accountPlansEnabled: () => false, accountPlanService: () => null }))
vi.mock("../domain/unsaved-draft-navigation", () => ({ registerUnsavedDraftGuard: () => () => {} }))
vi.mock("./OracleFriendComparisonV2", () => ({ OracleFriendComparisonV2: () => null }))
vi.mock("../hooks/useReaderDialog", async importOriginal => {
  const actual = await importOriginal<typeof import("../hooks/useReaderDialog")>()
  function useSyntheticReader(ref: React.RefObject<HTMLDialogElement | null>, close: () => void) {
    React.useEffect(() => { ref.current?.showModal() }, [ref])
    return close
  }
  return { ...actual,
    useReaderDialog: (ref: React.RefObject<HTMLDialogElement | null>, close: () => void) => {
      const useSelectedReader = readerMode.native ? actual.useReaderDialog : useSyntheticReader
      return useSelectedReader(ref, close)
    },
  }
})

const OWNER_A = "a1111111-1111-4111-8111-111111111111"
const OWNER_B = "b2222222-2222-4222-8222-222222222222"
const DATE = "2026-10-04T00:00:00.000Z"
const low: OracleResponses = { STRUCTURE_1: 1, STRUCTURE_2: 1, STRUCTURE_3: 1 }
const high: OracleResponses = { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 }
function scored(answers: OracleResponses = high, revision = 2) {
  const document = emptyOracleV2Document()
  document.data.current = makeOracleProfileRevision({ revision, answeredAt: DATE, answers })
  document.data.readings = [saveOracleProfileReading(makeOracleProfileRevision({
    revision: 1, answeredAt: "2026-10-01T00:00:00.000Z", answers: high,
  }), DATE)]
  document.data.context = { version: "ORACLE_CONTEXT_V1", answeredAt: DATE, answers: { movementForm: "INTERVAL" }, conditions: {} }
  return document
}
function ready(document: AccountOracleV2Document | null = null): OracleV2Store {
  return { status: document ? "READY" : "EMPTY", document, confirmedDocument: document, draftDocument: null, draftState: null,
    revision: document ? 4 : 0, sequence: document ? 4 : 0, legacyDocument: null, remote: null, remoteRevision: null, error: null }
}

// Only the service boundary is synthetic. Real controller, question state, context editor and result rendering run together.
function account(initial = ready()) {
  let state = structuredClone(initial)
  let listener: (next: OracleV2Store) => void = () => {}
  const publish = (next: OracleV2Store) => { state = structuredClone(next); listener(structuredClone(state)) }
  const exactToken = (token: string) => expect(token).toBe(oracleV2EditToken(state))
  const confirm = (document: AccountOracleV2Document) => publish({ ...ready(document),
    status: document.data.status === "DELETED" ? "DELETED" : "READY",
    confirmedDocument: document.data.status === "DELETED" ? null : document,
    revision: state.revision + 1, sequence: state.sequence + 1 })
  const saveDraft = vi.fn(async (input: unknown, token: string) => {
    exactToken(token)
    const parsed = accountOracleV2DocumentSchema.safeParse(input)
    const document = parsed.success ? parsed.data : structuredClone(state.draftDocument ?? state.confirmedDocument ?? emptyOracleV2Document())
    if (!parsed.success) document.data.current = makeOracleProfileRevision({
      revision: (state.confirmedDocument?.data.current?.revision ?? 0) + 1, answeredAt: DATE, answers: input as OracleResponses,
    })
    publish({ ...state, status: "PENDING", draftState: "EDITING", draftDocument: document, sequence: state.sequence + 1 })
    return true
  })
  const service = {
    hydrate: vi.fn(async () => { publish(state); return true }),
    snapshot: () => structuredClone(state), close: vi.fn(), saveDraft,
    save: vi.fn(async (input: unknown, token: string) => { exactToken(token); confirm(accountOracleV2DocumentSchema.parse(input)); return true }),
    commitAnswers: vi.fn(async (answers: unknown, selectedCharacter: OracleAxisId | null, token: string) => {
      exactToken(token)
      const document = structuredClone(state.draftDocument ?? state.confirmedDocument ?? emptyOracleV2Document())
      document.data.current = makeOracleProfileRevision({ revision: (state.confirmedDocument?.data.current?.revision ?? 0) + 1,
        answeredAt: DATE, answers: answers as OracleResponses, selectedCharacter })
      confirm(document); return true
    }),
    deleteProfile: vi.fn(async (token: string) => {
      exactToken(token); const document = emptyOracleV2Document(); document.data.status = "DELETED"; confirm(document); return true
    }),
    restartProfile: vi.fn(async (token: string, confirmation: "START_NEW_ORACLE_V2") => {
      exactToken(token); expect(state.status).toBe("DELETED"); expect(confirmation).toBe("START_NEW_ORACLE_V2")
      confirm(emptyOracleV2Document()); return true
    }),
    resolve: vi.fn(async (review: OracleV2Store, choice: "LOCAL" | "REMOTE") => {
      expect(review.status).toBe("CONFLICT"); expect(choice).toBe("REMOTE")
      const remote = accountOracleV2DocumentSchema.parse(review.remote)
      publish({ ...ready(remote), revision: review.remoteRevision!, sequence: state.sequence + 1 }); return true
    }),
    retry: vi.fn(async () => true), migrateV1: vi.fn(async () => true),
  } satisfies ReturnType<typeof createOracleV2Service>
  return { service, publish, bind: (changed: typeof listener) => { listener = changed } }
}
const accounts = new Map<string, ReturnType<typeof account>>()
beforeEach(() => {
  vi.clearAllMocks(); accounts.clear()
  readerMode.native = false
  recordSource.records = []
  vi.mocked(activeLocalAccount).mockReturnValue(OWNER_A)
  vi.mocked(createOracleV2Service).mockImplementation((owner, changed) => {
    const value = accounts.get(owner)
    if (!value) throw Error(`Missing synthetic account ${owner}`)
    value.bind(changed); return value.service
  })
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) { this.setAttribute("open", "") })
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute("open") })
  vi.stubGlobal("fetch", vi.fn(async () => { throw Error("Controller contract tests must not access the network") }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const props = { today: "2026-10-04", onBack: vi.fn(), onNavigate: vi.fn() }
const mount = (initial = ready()) => {
  const fixture = account(initial); accounts.set(OWNER_A, fixture)
  return { ...fixture, ...render(<OracleProfileV2 {...props} />) }
}
const contextButton = () => screen.getByRole("button", { name: /취향과 여건 더 알려주기|작성하던 추가 응답 이어가기/ })
const closeDialog = () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "닫기" }))
const resultScore = (container: HTMLElement) => container.querySelector(".oracle-v2__scores dd strong")
function contextAnswer() {
  const dialog = screen.getByRole("dialog", { name: "추가 응답" })
  fireEvent.click(within(dialog).getByRole("button", { name: /^어떤 달리기 방식이 더 좋은가요\?/ }))
  fireEvent.click(within(dialog).getByRole("button", { name: "멈추지 않고 이어 달리기" }))
}

const profileTopics = [
  ["A01", "내가 달리는 이유", "취향"],
  ["A02", "좋아하는 달리기 강도", "취향"],
  ["G04", "내 답은 어떻게 달라졌을까", "돌아보기"],
] as const
it.each(profileTopics.flatMap(topic => (["LOADING", "FAILED"] as const).map(status => ({ topic, status }))))(
  "$topic.0 keeps unconfirmed $status data UNAVAILABLE until a server EMPTY receipt makes it MISSING",
  ({ topic: [id, title, group], status }) => {
    const local = scored()
    const fixture = mount({ ...ready(), status, document: local, draftDocument: local, draftState: "EDITING", confirmedDocument: null })
    fireEvent.click(screen.getByRole("button", { name: "읽을거리" }))
    fireEvent.click(screen.getByRole("button", { name: group }))
    fireEvent.click(screen.getByRole("button", { name: title }))
    const reader = screen.getByRole("dialog", { name: title })
    expect(within(reader).getByText("자료를 확인하지 못했어요")).toBeVisible()
    expect(within(reader).queryByText("일반 해설")).toBeNull()
    expect(vi.mocked(buildOracleContentReading).mock.lastCall).toEqual([id, expect.objectContaining({
      answers: { state: "UNAVAILABLE" }, conditions: { state: "UNAVAILABLE" },
      profile: { state: "UNAVAILABLE" }, previousProfile: { state: "UNAVAILABLE" },
    })])
    expect(vi.mocked(buildOracleContentReading).mock.results.at(-1)).toMatchObject({
      type: "return", value: { status: "UNAVAILABLE", facts: [] },
    })

    act(() => fixture.publish({ ...ready(emptyOracleV2Document()), status: "EMPTY" }))
    expect(screen.getByRole("dialog", { name: title })).toBe(reader)
    expect(within(reader).getByText("일반 해설")).toBeVisible()
    expect(within(reader).queryByText("자료를 확인하지 못했어요")).toBeNull()
    expect(vi.mocked(buildOracleContentReading).mock.lastCall).toEqual([id, expect.objectContaining({
      answers: { state: "MISSING" }, conditions: { state: "MISSING" },
      profile: { state: "MISSING" }, previousProfile: { state: "MISSING" },
    })])
    expect(vi.mocked(buildOracleContentReading).mock.results.at(-1)).toMatchObject({
      type: "return", value: { status: "MISSING", facts: [] },
    })
    expect(fixture.service.save).not.toHaveBeenCalled()
    expect(fixture.service.saveDraft).not.toHaveBeenCalled()
  },
)

it.each([1, 3, 5] as const)("labels the self-report index denominator as a 100-point scale, not 100 observations (answer=%s)", response => {
  mount(ready(scored({ INTENSITY_1: response, INTENSITY_2: response, INTENSITY_3: response })))
  fireEvent.click(screen.getByRole("button", { name: "읽을거리" }))
  fireEvent.click(screen.getByRole("button", { name: "좋아하는 달리기 강도" }))
  const reader = screen.getByRole("dialog", { name: "좋아하는 달리기 강도" })
  const facts = reader.querySelector(".oracle-v2__facts")
  expect(facts).toHaveTextContent("100점 만점 · 내 응답")
  expect(facts).not.toHaveTextContent("확인한 100개 기준")
  expect(vi.mocked(buildOracleContentReading).mock.results.at(-1)).toMatchObject({
    type: "return", value: { facts: expect.arrayContaining([
      expect.objectContaining({ unit: "index", metric: "M01", denominator: 100 }),
    ]) },
  })
})

it("labels M05 race speed as an index with baseline 100, not a self-response score or observation count", () => {
  recordSource.records = [
    { schemaVersion: 1, id: "race-previous", purpose: "RECENT_RESULT", eventDistanceM: 5000, performanceSeconds: 1200,
      achievedOn: "2026-10-01", seasonId: null, enteredBy: "ATHLETE", verificationState: "SELF_REPORTED",
      sourceRef: "athlete-record:race-previous", savedAt: "2026-10-01T00:00:00.000Z" },
    { schemaVersion: 1, id: "race-recent", purpose: "PERSONAL_BEST", eventDistanceM: 5000, performanceSeconds: 1000,
      achievedOn: "2026-10-03", seasonId: null, enteredBy: "ATHLETE", verificationState: "SELF_REPORTED",
      sourceRef: "athlete-record:race-recent", savedAt: "2026-10-03T00:00:00.000Z" },
  ]
  mount(ready(scored()))
  fireEvent.click(screen.getByRole("button", { name: "읽을거리" }))
  fireEvent.click(screen.getByRole("button", { name: "경기 기록" }))
  fireEvent.click(screen.getByRole("button", { name: "최근 경기와 최고기록" }))
  const reader = screen.getByRole("dialog", { name: "최근 경기와 최고기록" })
  const facts = reader.querySelector<HTMLElement>(".oracle-v2__facts")!
  const row = within(facts).getByText("이전 경기 속도 = 100").parentElement!
  expect(row).toHaveTextContent("120 · 속도 지수")
  expect(row.querySelector("small")).toHaveTextContent("기준 100")
  expect(row).not.toHaveTextContent("점 만점")
  expect(row).not.toHaveTextContent("내 응답")
  expect(row).not.toHaveTextContent("확인한 100개 기준")
  expect(vi.mocked(buildOracleContentReading).mock.results.at(-1)).toMatchObject({
    type: "return", value: { facts: expect.arrayContaining([
      expect.objectContaining({ id: "race:speed-index", unit: "index", metric: "M05", value: 120, denominator: 100 }),
    ]) },
  })
})

it.each([OWNER_B, null])("hides prior account readings and open editors immediately on owner change to %s", async nextOwner => {
  const fixture = mount(ready(scored()))
  fireEvent.click(screen.getByRole("button", { name: "보관함" }))
  expect(screen.getByRole("button", { name: "2026-10-01 · 당시 응답" })).toBeVisible()
  fireEvent.click(contextButton()); contextAnswer()
  await waitFor(() => expect(fixture.service.saveDraft).toHaveBeenCalledTimes(1))
  const waiting = account({ ...ready(), status: "LOADING" })
  waiting.service.hydrate.mockImplementation(async () => true)
  accounts.set(OWNER_B, waiting)
  vi.mocked(activeLocalAccount).mockReturnValue(nextOwner)
  fixture.rerender(<OracleProfileV2 {...props} />)
  expect(screen.queryByRole("dialog", { name: "추가 응답" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "보관함" }))
  expect(screen.queryByRole("button", { name: "2026-10-01 · 당시 응답" })).toBeNull()
  expect(fixture.service.close).toHaveBeenCalledTimes(1)
  act(() => fixture.publish(ready(scored())))
  expect(screen.queryByRole("button", { name: "2026-10-01 · 당시 응답" })).toBeNull()
  if (nextOwner) act(() => waiting.publish(ready()))
  fireEvent.click(screen.getByRole("button", { name: "내 결과" }))
  expect(resultScore(fixture.container)).toBeNull()
  expect(screen.queryByRole("button", { name: "작성하던 답 이어가기" })).toBeNull()
  fireEvent.click(contextButton())
  fireEvent.click(within(screen.getByRole("dialog", { name: "추가 응답" })).getByRole("button", { name: /^어떤 달리기 방식이 더 좋은가요\?/ }))
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "멈추지 않고 이어 달리기" })).toHaveAttribute("aria-pressed", "false")
})

it("replaces a dirty in-screen result after choosing REMOTE in conflict review", async () => {
  const fixture = mount(ready(scored(low)))
  expect(resultScore(fixture.container)).toHaveTextContent("0")
  fireEvent.click(screen.getByRole("button", { name: /수정$/ }))
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "매우 그래요" }))
  await waitFor(() => expect(fixture.service.saveDraft).toHaveBeenCalledTimes(1))
  closeDialog()
  const remote = scored(high, 3)
  act(() => fixture.publish({ ...fixture.service.snapshot(), status: "CONFLICT", remote, remoteRevision: 5 }))
  fireEvent.click(screen.getByRole("button", { name: "계정의 응답 사용" }))
  await waitFor(() => expect(fixture.service.resolve).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(resultScore(fixture.container)).toHaveTextContent("100"))
  expect(screen.queryByRole("button", { name: "작성하던 답 이어가기" })).toBeNull()
  expect(fixture.service.commitAnswers).not.toHaveBeenCalled()
  expect(fixture.service.save).not.toHaveBeenCalled()
})

it.each([false, true])("cannot submit an unfinished score draft through the context editor (reloaded=%s)", async reloaded => {
  const draft = emptyOracleV2Document()
  draft.data.current = makeOracleProfileRevision({ revision: 1, answeredAt: DATE, answers: { STRUCTURE_1: 5 } })
  const fixture = mount(reloaded ? { ...ready(), status: "PENDING", draftDocument: draft, draftState: "EDITING", sequence: 1 } : ready())
  if (!reloaded) {
    fireEvent.click(screen.getByRole("button", { name: "3문항으로 알아보기" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "매우 그래요" }))
    await waitFor(() => expect(fixture.service.saveDraft).toHaveBeenCalledTimes(1))
    closeDialog()
  }
  fireEvent.click(contextButton())
  expect(screen.queryByRole("dialog", { name: "추가 응답" })).toBeNull()
  expect(fixture.service.save).not.toHaveBeenCalled()
  expect(fixture.service.commitAnswers).not.toHaveBeenCalled()
  expect(fixture.service.snapshot().draftDocument?.data.current?.answers).toEqual({ STRUCTURE_1: 5 })
  expect(resultScore(fixture.container)).toBeNull()
})

it.each([false, true])("saves context atomically without manufacturing or changing score revisions (scored=%s)", async hasScore => {
  const document = hasScore ? scored() : emptyOracleV2Document()
  const fixture = mount(ready(document))
  fireEvent.click(contextButton()); contextAnswer()
  await waitFor(() => expect(fixture.service.saveDraft).toHaveBeenCalledTimes(1))
  const draft = fixture.service.saveDraft.mock.calls[0]![0] as AccountOracleV2Document
  expect(draft.data.current).toEqual(document.data.current)
  expect(draft.data.context?.answers.movementForm).toBe("CONTINUOUS")
  expect(fixture.service.save).not.toHaveBeenCalled()
  fireEvent.click(within(screen.getByRole("dialog", { name: "추가 응답" })).getByRole("button", { name: "응답 반영" }))
  await waitFor(() => expect(fixture.service.save).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(within(screen.getByRole("dialog", { name: "추가 응답" })).getByRole("status")).toHaveTextContent("응답을 반영했어요."))
  const saved = fixture.service.save.mock.calls[0]![0] as AccountOracleV2Document
  expect(saved.data.current).toEqual(document.data.current)
  expect(saved.data.readings).toEqual(document.data.readings)
  expect(saved.data.context?.answers.movementForm).toBe("CONTINUOUS")
  expect(fixture.service.commitAnswers).not.toHaveBeenCalled()
})

it.each([false, true])("rechecks score-draft isolation when context is open and a new revision arrives (same answers=%s)", async sameAnswers => {
  const document = sameAnswers ? scored() : null
  const fixture = mount(ready(document))
  fireEvent.click(contextButton()); contextAnswer()
  await waitFor(() => expect(fixture.service.saveDraft).toHaveBeenCalledTimes(1))
  const state = fixture.service.snapshot()
  const draft = structuredClone(state.draftDocument!)
  draft.data.current = makeOracleProfileRevision({ revision: (document?.data.current?.revision ?? 0) + 1,
    answeredAt: DATE, answers: sameAnswers ? high : { STRUCTURE_1: 5 } })
  act(() => fixture.publish({ ...state, draftDocument: draft, sequence: state.sequence + 1 }))
  const editor = screen.queryByRole("dialog", { name: "추가 응답" })
  if (editor) await act(async () => { fireEvent.click(within(editor).getByRole("button", { name: "응답 반영" })) })
  expect(fixture.service.save).not.toHaveBeenCalled()
  expect(fixture.service.commitAnswers).not.toHaveBeenCalled()
  expect(fixture.service.snapshot().confirmedDocument?.data.current ?? null).toEqual(document?.data.current ?? null)
})

it("resumes question two after a same-value first edit and reload, without clearing confirmed answers or allowing context/axis switches", async () => {
  const document = scored()
  const fixture = mount(ready(document))
  fireEvent.click(screen.getByRole("button", { name: /수정$/ }))
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "매우 그래요" }))
  await waitFor(() => expect(fixture.service.saveDraft).toHaveBeenCalledTimes(1))
  const pending = fixture.service.snapshot()
  expect(pending.draftDocument?.data.current?.answers).toEqual({ STRUCTURE_1: 5 })
  expect(pending.draftDocument?.data.current?.revision).toBe(document.data.current!.revision + 1)
  expect(pending.confirmedDocument).toEqual(document)
  expect(fixture.service.commitAnswers).not.toHaveBeenCalled()
  fixture.unmount()
  const reopened = render(<OracleProfileV2 {...props} />)
  expect(resultScore(reopened.container)).toHaveTextContent("100")
  expect(screen.getByRole("status")).not.toHaveTextContent("계정으로 보내는 중")
  fireEvent.click(contextButton())
  expect(screen.queryByRole("dialog", { name: "추가 응답" })).toBeNull()
  const social = ORACLE_AXES.find(axis => axis.id === "SOCIAL")!
  fireEvent.click(screen.getByRole("button", { name: social.label }))
  expect(screen.queryByRole("dialog", { name: social.label })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "작성하던 답 이어가기" }))
  const question = ORACLE_QUESTIONS.find(item => item.id === "STRUCTURE_2")!
  expect(within(screen.getByRole("dialog")).getByRole("heading", { name: question.text })).toBeVisible()
  expect(within(screen.getByRole("dialog")).getByText("2 / 3")).toBeVisible()
  expect(fixture.service.snapshot().confirmedDocument).toEqual(document)
  expect(fixture.service.saveDraft).toHaveBeenCalledTimes(1)
  expect(fixture.service.save).not.toHaveBeenCalled()
  expect(fixture.service.commitAnswers).not.toHaveBeenCalled()
})

it("blocks context for a legacy filled draft with identical answers but a newer current revision and restarts review at question one", () => {
  const document = scored()
  const draft = structuredClone(document)
  draft.data.current!.revision += 1
  const fixture = mount({ ...ready(document), status: "PENDING", draftDocument: draft, draftState: "EDITING", sequence: 5 })
  expect(draft.data.current!.answers).toEqual(document.data.current!.answers)
  expect(resultScore(fixture.container)).toHaveTextContent("100")
  expect(screen.getByRole("status")).not.toHaveTextContent("계정으로 보내는 중")
  fireEvent.click(contextButton())
  expect(screen.queryByRole("dialog", { name: "추가 응답" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "작성하던 답 이어가기" }))
  const question = ORACLE_QUESTIONS.find(item => item.id === "STRUCTURE_1")!
  expect(within(screen.getByRole("dialog")).getByRole("heading", { name: question.text })).toBeVisible()
  expect(within(screen.getByRole("dialog")).getByText("1 / 3")).toBeVisible()
  expect(fixture.service.snapshot().confirmedDocument).toEqual(document)
  expect(fixture.service.save).not.toHaveBeenCalled()
  expect(fixture.service.commitAnswers).not.toHaveBeenCalled()
})

it("clears results, readings and context on deletion and restarts only through the explicit empty-profile action", async () => {
  const fixture = mount(ready(scored()))
  expect(resultScore(fixture.container)).toHaveTextContent("100")
  fireEvent.click(screen.getByText("내 응답 관리"))
  fireEvent.click(screen.getByRole("button", { name: "응답 삭제" }))
  fireEvent.click(screen.getByRole("button", { name: "삭제하기" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "빈 프로필로 새로 시작" })).toBeVisible())
  expect(fixture.service.restartProfile).not.toHaveBeenCalled()
  expect(resultScore(fixture.container)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "보관함" }))
  expect(screen.queryByRole("button", { name: "2026-10-01 · 당시 응답" })).toBeNull()
  const tombstoneToken = oracleV2EditToken(fixture.service.snapshot())
  fireEvent.click(screen.getByRole("button", { name: "빈 프로필로 새로 시작" }))
  await waitFor(() => expect(fixture.service.restartProfile).toHaveBeenCalledWith(tombstoneToken, "START_NEW_ORACLE_V2"))
  expect(fixture.service.snapshot().confirmedDocument).toEqual(emptyOracleV2Document())
  fireEvent.click(screen.getByRole("button", { name: "내 결과" }))
  expect(screen.getByRole("button", { name: "3문항으로 알아보기" })).toBeEnabled()
  expect(resultScore(fixture.container)).toBeNull()
  fireEvent.click(contextButton())
  fireEvent.click(within(screen.getByRole("dialog", { name: "추가 응답" })).getByRole("button", { name: /^어떤 달리기 방식이 더 좋은가요\?/ }))
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "쉬었다 반복해서 달리기" })).toHaveAttribute("aria-pressed", "false")
  closeDialog()
  fireEvent.click(screen.getByRole("button", { name: "3문항으로 알아보기" }))
  for (let index = 0; index < 3; index++) fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "매우 그래요" }))
  await waitFor(() => expect(fixture.service.commitAnswers).toHaveBeenCalledTimes(1))
  expect(fixture.service.snapshot().confirmedDocument?.data.current?.revision).toBe(1)
  expect(fixture.service.snapshot().confirmedDocument?.data.context).toBeUndefined()
  expect(fixture.service.snapshot().confirmedDocument?.data.readings).toEqual([])
})

it.each([{ native: false, strict: false }, { native: true, strict: false }, { native: true, strict: true }])(
  "retains guest STRUCTURE 5/5/5 after closing its result reader (native history=$native, StrictMode=$strict)", async ({ native, strict }) => {
  readerMode.native = native
  vi.mocked(activeLocalAccount).mockReturnValue(null)
  const baseHistory = { controllerGuestTest: "profile" }
  window.history.replaceState(baseHistory, "")
  const back = vi.spyOn(window.history, "back")
  const view = () => strict ? <React.StrictMode><OracleProfileV2 {...props} /></React.StrictMode> : <OracleProfileV2 {...props} />
  const mounted = render(view())
  fireEvent.click(screen.getByRole("button", { name: "3문항으로 알아보기" }))
  for (let index = 0; index < 3; index++) {
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "매우 그래요" }))
  }
  await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("100")).toBeVisible())
  expect(resultScore(mounted.container)).toHaveTextContent("100")
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "결과로" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(resultScore(mounted.container)).toHaveTextContent("100")
  expect(screen.queryByRole("button", { name: "3문항으로 알아보기" })).toBeNull()
  if (native) { expect(back).toHaveBeenCalledTimes(1); expect(window.history.state).toEqual(baseHistory) }
  mounted.rerender(view())
  expect(resultScore(mounted.container)).toHaveTextContent("100")
  expect(createOracleV2Service).not.toHaveBeenCalled()
})
