import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ImportActivities } from "../ImportActivities"
import { RestoreBackup } from "../RestoreBackup"
import { SavedStage } from "./ImportStages"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { markCurrentConfirmedAccountJournalProjection, resetAccountJournalProjection } from "../../domain/account/account-journal-projection"
import type { JournalEntry } from "../../domain/journal-schema"
import * as activityParser from "../../domain/import/parse-activity-file-async"
import * as accountImport from "../../domain/import/account-import"
import { FULL_FORMAT } from "../../domain/restore/backup-file"
import { createEmptyDecorationState } from "../../domain/decoration-schema"
import { createEmptyCalendarDecorationState } from "../../domain/calendar-decoration-schema"

const api = vi.hoisted(() => ({ hydrate: vi.fn(), persist: vi.fn(), decorHydrate: vi.fn(), decorPersist: vi.fn(), decorRead: vi.fn(),
  calendarHydrate: vi.fn(), calendarPersist: vi.fn(), calendarRead: vi.fn() }))
vi.mock("../../domain/account/account-decoration-service", () => ({
  hydrateAccountDecorations: api.decorHydrate, persistAccountDecorations: api.decorPersist,
  readAccountDecorationState: api.decorRead, accountDecorationStatus: () => "READY",
}))
vi.mock("../../domain/account/account-calendar-decoration-service", () => ({
  hydrateAccountCalendarDecorations: api.calendarHydrate, persistAccountCalendarDecorations: api.calendarPersist,
  readAccountCalendarDecorationState: api.calendarRead, accountCalendarDecorationStatus: () => "READY",
}))
vi.mock("../../domain/account/account-journal-record-service", () => ({
  accountJournalRecordsEnabled: () => true, hydrateAccountJournalRecords: api.hydrate,
  refreshAccountJournalRecordsForImport: api.hydrate,
  retryAccountJournalFileImport: async () => null,
  persistAccountJournalRecord: api.persist, accountJournalDeletedDocuments: () => [],
  accountJournalDocumentId: async (_owner: string, id: string) => id,
  readAccountJournalWriteBase: async () => ({ entry: null, revision: 0, contentFingerprint: null }),
  accountJournalEntryFingerprint: async ({ syncState: _transport, ...entry }: Record<string, unknown>) => JSON.stringify(entry),
}))

beforeEach(() => {
  vi.resetAllMocks(); setActiveLocalAccount("A"); resetAccountJournalProjection("A")
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true"); vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
  api.hydrate.mockResolvedValue(true); api.persist.mockResolvedValue({ ok: true, storage: "ACCOUNT" })
  api.decorHydrate.mockResolvedValue(true); api.decorRead.mockReturnValue(createEmptyDecorationState())
  api.decorPersist.mockResolvedValue({ ok: true, storage: "ACCOUNT", state: createEmptyDecorationState() })
  api.calendarHydrate.mockResolvedValue(true); api.calendarRead.mockReturnValue(createEmptyCalendarDecorationState())
  api.calendarPersist.mockResolvedValue({ ok: true, storage: "ACCOUNT", state: createEmptyCalendarDecorationState() })
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe("next action follows account import confirmation", () => {
  it.each([
    { account: 1, pending: 1, failed: 0, name: "저장 다시 시도", target: "retry" },
    { account: 1, pending: 0, failed: 1, name: "저장 다시 시도", target: "retry" },
    { account: 1, pending: 0, failed: 0, name: "전체 가져온 기록 분석", target: "analysis" },
  ])("routes the next action for $account confirmed, $pending pending, $failed failed", async ({ account, pending, failed, name, target }) => {
    const retry = vi.fn(), analysis = vi.fn()
    const { container } = render(<SavedStage outcome={{ total: account + pending + failed, saved: 0, merged: 0, account, pending, failed, conflicts: 0 }}
      analysisAvailable onRetry={retry} onOpenAnalysis={analysis} onRestart={vi.fn()} />)
    const next = container.querySelector<HTMLButtonElement>('button.record-action[data-priority="primary"]')!
    expect(container.querySelectorAll('button.record-action[data-priority="primary"]')).toHaveLength(1)
    expect(next).toHaveAccessibleName(name)
    expect(retry).not.toHaveBeenCalled()
    expect(analysis).not.toHaveBeenCalled()
    await userEvent.setup().click(next)
    expect(target === "retry" ? retry : analysis).toHaveBeenCalledTimes(1)
    expect(target === "retry" ? analysis : retry).not.toHaveBeenCalled()
  })

  it("offers the confirmed-record view when analysis is unavailable without retrying the import", async () => {
    const retry = vi.fn(), summary = vi.fn(), analysis = vi.fn()
    const { container } = render(<SavedStage outcome={{ total: 1, saved: 0, account: 1, pending: 0, failed: 0 }}
      onRetry={retry} onOpenAnalysis={analysis} onOpenSummary={summary} onRestart={vi.fn()} />)
    const next = container.querySelector<HTMLButtonElement>('button.record-action[data-priority="primary"]')!
    expect(next).toHaveAccessibleName("가져온 기록 보기")
    await userEvent.setup().click(next)
    expect(summary).toHaveBeenCalledTimes(1)
    expect(retry).not.toHaveBeenCalled()
    expect(analysis).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "전체 가져온 기록 분석" })).toBeNull()
  })
})

function watchFile() {
  return new File([JSON.stringify([{ date: "2026-07-20", name: "Synthetic watch", sport: "running", distanceKm: 5, durationMin: 30 }])], "watch.json", { type: "application/json" })
}
function tcxWatchFile() {
  return new File([`<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-07-20T06:00:00Z</Id><Lap StartTime="2026-07-20T06:00:00Z"><TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters></Lap></Activity></Activities></TrainingCenterDatabase>`], "watch.tcx", { type: "application/xml" })
}

describe("analysis action uses this batch's confirmed file evidence", () => {
  it.each(["other-format-only", "off", "kill", "no-observation", "unconfirmed", "pending", "conflict", "confirmed"] as const)("checks the %s boundary before exposing analysis", async mode => {
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", mode === "off" ? "false" : "true")
    vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", mode === "kill" ? "true" : "false")
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_JSON", mode === "off" || mode === "kill" ? "true" : "false")
    if (mode === "no-observation") vi.spyOn(activityParser, "parseActivityFileAsync").mockResolvedValueOnce({
      format: "tcx", skipped: 0, activities: [{ date: "2026-07-20", name: "Synthetic legacy activity", sport: "running", distanceKm: "5", durationMin: "30", avgPace: "6:00" }],
    })
    api.persist.mockImplementation(async (entry: JournalEntry) => {
      if (mode !== "unconfirmed" && mode !== "pending" && mode !== "conflict") markCurrentConfirmedAccountJournalProjection("A", entry, 1)
      return { ok: true, storage: mode === "pending" ? "PENDING" : mode === "conflict" ? "CONFLICT" : "ACCOUNT" }
    })
    const analysis = vi.fn(), summary = vi.fn(), user = userEvent.setup()
    render(<ImportActivities onOpenAnalysis={analysis} onOpenSummary={summary} />)
    await user.upload(screen.getByLabelText(/가져올 운동 파일 선택/), mode === "other-format-only" ? watchFile() : tcxWatchFile())
    await user.click(await screen.findByRole("button", { name: "고른 1건 일지에 저장" }))
    await screen.findByTestId("import-saved")
    expect(api.persist).toHaveBeenCalledOnce()
    expect(analysis).not.toHaveBeenCalled()
    if (mode === "confirmed") {
      await user.click(screen.getByRole("button", { name: "전체 가져온 기록 분석" }))
      expect(analysis).toHaveBeenCalledOnce()
      expect(summary).not.toHaveBeenCalled()
    } else {
      expect(screen.queryByRole("button", { name: "전체 가져온 기록 분석" })).toBeNull()
      if (mode !== "pending" && mode !== "conflict") {
        await user.click(screen.getByRole("button", { name: "가져온 기록 보기" }))
        expect(summary).toHaveBeenCalledOnce()
      }
    }
  })

  it("preserves the batch evidence through retry and offers analysis only after account confirmation", async () => {
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true")
    vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "false")
    api.persist.mockResolvedValueOnce({ ok: true, storage: "PENDING" })
      .mockImplementationOnce(async (entry: JournalEntry) => {
        markCurrentConfirmedAccountJournalProjection("A", entry, 1)
        return { ok: true, storage: "ACCOUNT" }
      })
    const analysis = vi.fn(), user = userEvent.setup()
    render(<ImportActivities onOpenAnalysis={analysis} />)
    await user.upload(screen.getByLabelText(/가져올 운동 파일 선택/), tcxWatchFile())
    await user.click(await screen.findByRole("button", { name: "고른 1건 일지에 저장" }))
    await screen.findByTestId("import-saved")
    expect(screen.queryByRole("button", { name: "전체 가져온 기록 분석" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "저장 다시 시도" }))
    await user.click(await screen.findByRole("button", { name: "전체 가져온 기록 분석" }))
    expect(analysis).toHaveBeenCalledOnce()
    expect(api.persist).toHaveBeenCalledTimes(2)
  })
})
function backupFile(decorated = false) {
  return new File([JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT, ...(decorated ? { decorations: createEmptyDecorationState() } : {}), entries: [{
    id: "synthetic-backup", date: "2026-07-20", kind: "post-session", syncState: "local", savedAt: "2026-07-20T09:00:00.000Z",
    system: "base", title: "Synthetic backup", distanceKm: "5", durationMin: "30", avgPace: "6:00", rpe: 4,
    memo: "Synthetic private memo", memoPurpose: "PRIVATE_SELF_ONLY",
  }] })], "backup.json", { type: "application/json" })
}

describe("account import and restore screens", () => {
  it.each(["same-reuse", "same-attach", "changed-kind", "changed-base"] as const)("keeps only unchanged existing-record choices when another row changes: %s", async mode => {
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true")
    vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "false")
    let read = 0
    vi.spyOn(accountImport, "buildAccountImportDrafts").mockImplementation(async activities => {
      read += 1
      return activities.map((activity, index) => ({ activity, duplicateOf: null, reconciliationCandidates: [], sourceIndex: index,
        identityCandidates: index === 1 ? [{ id: "existing-b", savedAt: "2026-07-20T12:00:00Z", title: "저장된 운동 B",
          kind: mode === "same-attach" || mode === "changed-kind" && read > 1 ? "ATTACH" as const : "REUSE" as const }] : [],
        accountWriteBases: Object.fromEntries(index === 1 ? [["existing-b", { revision: mode === "changed-base" && read > 1 ? 3 : 2, contentFingerprint: "synthetic-b" }]] : []),
      }))
    })
    const xml = await tcxWatchFile().text()
    const second = xml.replaceAll("06:00:00Z", "09:00:00Z").match(/<Activity [\s\S]*<\/Activity>/)![0]
    const file = new File([xml.replace("</Activities>", `${second}</Activities>`)], "two.tcx", { type: "application/xml" })
    const user = userEvent.setup()
    render(<ImportActivities />)
    await user.upload(screen.getByLabelText(/가져올 운동 파일 선택/), file)
    await user.click(await screen.findByRole("checkbox", { name: /운동 2, .*가져오기/ }))
    await user.selectOptions(screen.getByRole("combobox", { name: /운동 2, .*저장 방식/ }), "use:existing-b")
    const first = screen.getAllByTestId("import-draft-row")[0]!
    await user.click(within(first).getByText("시간과 날짜 확인"))
    await user.selectOptions(within(first).getByRole("combobox", { name: "파일의 시간은 어떤 시간인가요?" }), "TIMER")
    const choice = screen.getByRole("combobox", { name: /운동 2, .*저장 방식/ })
    await waitFor(() => expect(choice).toBeEnabled())
    expect(choice).toHaveValue(mode.startsWith("same-") ? "use:existing-b" : "")
    expect(screen.getByRole("checkbox", { name: /운동 2, .*가져오기/ })).toBeChecked()
    if (mode.startsWith("changed-")) expect(screen.getByRole("alert")).toHaveTextContent("운동 2의 기존 일지가 바뀌었어요")
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("reopens a conflicted file with fresh read-only review, preserving the result on read failure", async () => {
    api.persist.mockResolvedValue({ ok: true, storage: "CONFLICT" })
    const user = userEvent.setup()
    render(<ImportActivities />)
    await user.upload(screen.getByLabelText(/가져올 운동 파일 선택/), watchFile())
    await user.click(await screen.findByRole("button", { name: "고른 1건 일지에 저장" }))
    await screen.findByTestId("import-saved")
    const review = screen.getByRole("button", { name: "원래 파일 다시 검토" })
    expect(review).toHaveClass("record-action")
    expect(review).toHaveAttribute("data-priority", "primary")
    const readsBeforeReview = api.hydrate.mock.calls.length
    api.hydrate.mockResolvedValueOnce(false)
    await user.click(review)
    expect(await screen.findByRole("alert")).toHaveTextContent("저장 결과는 유지했어요")
    expect(screen.getByTestId("import-saved")).toBeVisible()
    await user.click(review)
    expect(await screen.findByRole("checkbox")).not.toBeChecked()
    expect(screen.getByRole("button", { name: "저장할 활동을 골라 주세요" })).toBeDisabled()
    expect(api.hydrate).toHaveBeenCalledTimes(readsBeforeReview + 2)
    expect(api.persist).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("import-saved")).toBeNull()
    await user.click(screen.getByRole("checkbox"))
    await user.selectOptions(screen.getByRole("combobox", { name: /저장 방식/ }), "separate")
    await user.click(screen.getByRole("button", { name: "고른 1건 일지에 저장" }))
    await screen.findByTestId("import-saved")
    expect(screen.queryByRole("alert")).toBeNull()
    expect(api.persist).toHaveBeenCalledTimes(2)
  })

  it("requires explicit decoration replacement and displays partial/ownership failure honestly", async () => {
    api.decorPersist.mockResolvedValue({ ok: false, code: "WRITE_FAILED" })
    render(<RestoreBackup />)
    const user = userEvent.setup()
    await user.upload(screen.getByLabelText(/백업 파일/), backupFile(true))
    const replace = await screen.findByRole("radio", { name: /백업의 꾸미기로 바꿔요/ })
    expect(replace).toHaveAttribute("aria-checked", "false")
    expect(api.decorPersist).not.toHaveBeenCalled()
    await user.click(replace)
    await user.click(screen.getByTestId("restore-submit"))
    const result = await screen.findByTestId("restore-account-result")
    expect(result).toHaveTextContent("일부 복원 (PARTIAL)")
    expect(result).toHaveTextContent("소유권 또는 저장 조건을 확인하지 못해")
    expect(result).toHaveTextContent("계정에 저장됨 1건")
    expect(result).not.toHaveTextContent("꾸미기: 계정에 저장됨")
    expect(api.decorPersist).toHaveBeenCalledTimes(1)
  })
  it("keeps cancellation effective while the account review hydration is pending", async () => {
    let resolve!: (value: boolean) => void
    api.hydrate.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    render(<ImportActivities />)
    const user = userEvent.setup()
    await user.upload(screen.getByLabelText(/가져올 운동 파일 선택/), watchFile())
    await waitFor(() => expect(api.hydrate).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole("button", { name: "가져오기 취소" }))
    await act(async () => { resolve(true); await Promise.resolve() })
    expect(screen.getByTestId("import-failure")).toHaveTextContent("가져오기를 취소")
    expect(screen.queryByRole("button", { name: "고른 1건 일지에 저장" })).not.toBeInTheDocument()
  })
  it("routes confirmed watch data asynchronously and distinguishes pending from account acknowledgment", async () => {
    api.persist.mockResolvedValueOnce({ ok: true, storage: "PENDING" })
    render(<ImportActivities />)
    expect(screen.getByTestId("import-privacy-notice")).toHaveTextContent("암호화 보관 경로로 전송")
    const user = userEvent.setup()
    await user.upload(screen.getByLabelText(/가져올 운동 파일 선택/), watchFile())
    const save = await screen.findByRole("button", { name: "고른 1건 일지에 저장" })
    expect(api.persist).not.toHaveBeenCalled()
    fireEvent.click(save); fireEvent.click(save)
    const counts = await screen.findByRole("list", { name: "저장 상태별 기록 수" })
    expect(within(counts).getAllByRole("listitem").map(item => item.textContent)).toEqual(["계정에 저장됨 0건", "저장 확인 대기 1건"])
    expect(api.persist).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole("button", { name: "저장 다시 시도" }))
    await waitFor(() => expect(screen.getByRole("list", { name: "저장 상태별 기록 수" })).toHaveTextContent("계정에 저장됨 1건"))
    expect(screen.getByRole("list", { name: "저장 상태별 기록 수" })).not.toHaveTextContent("저장 확인 대기")
    expect(api.persist.mock.calls[0]![0]).toEqual(api.persist.mock.calls[1]![0])
  })

  it("routes private JSON backup to the account adapter, not the legacy recovery-code path", async () => {
    api.persist.mockResolvedValue({ ok: true, storage: "PENDING" })
    render(<RestoreBackup />)
    expect(screen.getByTestId("restore-privacy-notice")).toHaveTextContent("기록과 메모만 현재 로그인한 계정")
    await userEvent.setup().upload(screen.getByLabelText(/백업 파일/), backupFile())
    const save = await screen.findByTestId("restore-submit")
    expect(api.persist).not.toHaveBeenCalled()
    fireEvent.click(save); fireEvent.click(save)
    await waitFor(() => expect(screen.getByTestId("restore-account-result")).toHaveTextContent("계정에 저장됨 0건 · 연결 대기 1건"))
    expect(api.persist).toHaveBeenCalledTimes(1)
    expect(api.persist.mock.calls[0]![0]).toMatchObject({ memo: "Synthetic private memo" })
    expect(screen.queryByTestId("restore-done")).not.toBeInTheDocument()
  })

  it.each(["watch", "backup"])("clears %s review and rejects stale success after A-B-A", async (kind) => {
    let resolve!: (value: unknown) => void
    api.persist.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const user = userEvent.setup()
    render(kind === "watch" ? <ImportActivities /> : <RestoreBackup />)
    await user.upload(screen.getByLabelText(kind === "watch" ? /가져올 운동 파일 선택/ : /백업 파일/), kind === "watch" ? watchFile() : backupFile())
    fireEvent.click(kind === "watch" ? await screen.findByRole("button", { name: "고른 1건 일지에 저장" }) : await screen.findByTestId("restore-submit"))
    await waitFor(() => expect(api.persist).toHaveBeenCalledTimes(1))
    act(() => { setActiveLocalAccount("B"); setActiveLocalAccount("A") })
    await act(async () => { resolve({ ok: true, storage: "ACCOUNT" }); await Promise.resolve() })
    expect(screen.queryByTestId("import-saved")).not.toBeInTheDocument()
    expect(screen.queryByTestId("restore-account-result")).not.toBeInTheDocument()
    expect(screen.getByLabelText(kind === "watch" ? /가져올 운동 파일 선택/ : /백업 파일/)).toBeEnabled()
  })

  it.each(["watch", "backup"])("cancels %s file reads on owner change before hydration", async (kind) => {
    let resolve!: (value: boolean) => void
    api.hydrate.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    render(kind === "watch" ? <ImportActivities /> : <RestoreBackup />)
    await userEvent.setup().upload(screen.getByLabelText(kind === "watch" ? /가져올 운동 파일 선택/ : /백업 파일/), kind === "watch" ? watchFile() : backupFile())
    await waitFor(() => expect(api.hydrate).toHaveBeenCalledTimes(1))
    act(() => { setActiveLocalAccount("B"); setActiveLocalAccount("A") })
    await act(async () => { resolve(true); await Promise.resolve() })
    expect(screen.queryByTestId("restore-submit")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "고른 1건 일지에 저장" })).not.toBeInTheDocument()
    expect(api.persist).not.toHaveBeenCalled()
  })
})
