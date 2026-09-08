import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ImportActivities } from "../ImportActivities"
import { RestoreBackup } from "../RestoreBackup"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { resetAccountJournalProjection } from "../../domain/account/account-journal-projection"
import { FULL_FORMAT } from "../../domain/restore/backup-file"
import { createEmptyDecorationState } from "../../domain/decoration-schema"

const api = vi.hoisted(() => ({ hydrate: vi.fn(), persist: vi.fn(), decorHydrate: vi.fn(), decorPersist: vi.fn(), decorRead: vi.fn() }))
vi.mock("../../domain/account/account-decoration-service", () => ({
  hydrateAccountDecorations: api.decorHydrate, persistAccountDecorations: api.decorPersist,
  readAccountDecorationState: api.decorRead, accountDecorationStatus: () => "READY",
}))
vi.mock("../../domain/account/account-journal-record-service", () => ({
  accountJournalRecordsEnabled: () => true, hydrateAccountJournalRecords: api.hydrate,
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
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.unstubAllEnvs() })

function watchFile() {
  return new File([JSON.stringify([{ date: "2026-07-20", name: "Synthetic watch", sport: "running", distanceKm: 5, durationMin: 30 }])], "watch.json", { type: "application/json" })
}
function backupFile(decorated = false) {
  return new File([JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT, ...(decorated ? { decorations: createEmptyDecorationState() } : {}), entries: [{
    id: "synthetic-backup", date: "2026-07-20", kind: "post-session", syncState: "local", savedAt: "2026-07-20T09:00:00.000Z",
    system: "base", title: "Synthetic backup", distanceKm: "5", durationMin: "30", avgPace: "6:00", rpe: 4,
    memo: "Synthetic private memo", memoPurpose: "PRIVATE_SELF_ONLY",
  }] })], "backup.json", { type: "application/json" })
}

describe("account import and restore screens", () => {
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
    await user.upload(screen.getByLabelText(/내보낸 활동 파일/), watchFile())
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
    await user.upload(screen.getByLabelText(/내보낸 활동 파일/), watchFile())
    const save = await screen.findByRole("button", { name: "고른 1건 일지에 저장" })
    expect(api.persist).not.toHaveBeenCalled()
    fireEvent.click(save); fireEvent.click(save)
    await waitFor(() => expect(screen.getByTestId("import-saved")).toHaveTextContent("계정에 저장됨 0건 · 연결 대기 1건"))
    expect(api.persist).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole("button", { name: "저장 상태 다시 확인" }))
    await waitFor(() => expect(screen.getByTestId("import-saved")).toHaveTextContent("계정에 저장됨 1건 · 연결 대기 0건"))
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
    await user.upload(screen.getByLabelText(kind === "watch" ? /내보낸 활동 파일/ : /백업 파일/), kind === "watch" ? watchFile() : backupFile())
    fireEvent.click(kind === "watch" ? await screen.findByRole("button", { name: "고른 1건 일지에 저장" }) : await screen.findByTestId("restore-submit"))
    await waitFor(() => expect(api.persist).toHaveBeenCalledTimes(1))
    act(() => { setActiveLocalAccount("B"); setActiveLocalAccount("A") })
    await act(async () => { resolve({ ok: true, storage: "ACCOUNT" }); await Promise.resolve() })
    expect(screen.queryByTestId("import-saved")).not.toBeInTheDocument()
    expect(screen.queryByTestId("restore-account-result")).not.toBeInTheDocument()
    expect(screen.getByLabelText(kind === "watch" ? /내보낸 활동 파일/ : /백업 파일/)).toBeEnabled()
  })

  it.each(["watch", "backup"])("cancels %s file reads on owner change before hydration", async (kind) => {
    let resolve!: (value: boolean) => void
    api.hydrate.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    render(kind === "watch" ? <ImportActivities /> : <RestoreBackup />)
    await userEvent.setup().upload(screen.getByLabelText(kind === "watch" ? /내보낸 활동 파일/ : /백업 파일/), kind === "watch" ? watchFile() : backupFile())
    await waitFor(() => expect(api.hydrate).toHaveBeenCalledTimes(1))
    act(() => { setActiveLocalAccount("B"); setActiveLocalAccount("A") })
    await act(async () => { resolve(true); await Promise.resolve() })
    expect(screen.queryByTestId("restore-submit")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "고른 1건 일지에 저장" })).not.toBeInTheDocument()
    expect(api.persist).not.toHaveBeenCalled()
  })
})
