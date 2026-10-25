import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { FULL_FORMAT } from "../domain/restore/backup-file"
import type { AccountRestoreOutcome } from "../domain/restore/account-restore"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { RestoreBackup } from "./RestoreBackup"

const service = vi.hoisted(() => ({ confirm: vi.fn(), dispose: vi.fn() }))
vi.mock("../domain/account/account-journal-record-service", async original => ({
  ...await original<typeof import("../domain/account/account-journal-record-service")>(), accountJournalRecordsEnabled: () => true,
}))
vi.mock("../domain/restore/account-restore", async () => {
  const { buildRestorePlan } = await import("../domain/restore/backup-file")
  return { createAccountBackupRestoration: async (read: { entries: Parameters<typeof buildRestorePlan>[0] }) => ({
    plan: buildRestorePlan(read.entries, []), confirm: service.confirm, dispose: service.dispose,
    decorationReady: false, calendarReady: false,
  }) }
})

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); await initializeCanonicalJournalFixture(); setActiveLocalAccount("synthetic-restore-owner")
  vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("synthetic restore navigation forbids network") }))
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.unstubAllGlobals() })

it.each(["COMPLETE", "PENDING", "PARTIAL", "FAILED"] as const)("opens Journal after an account %s result without restoring again", async commit => {
  const result: AccountRestoreOutcome = { commit, account: commit === "COMPLETE" ? 1 : 0, pending: commit === "PENDING" ? 1 : 0,
    failed: commit === "FAILED" || commit === "PARTIAL" ? 1 : 0, conflicts: 0, keptExisting: 0, blockedByDeletion: 0,
    total: 1, decorationRestore: "NOT_INCLUDED", decorationFailure: "NONE" }
  service.confirm.mockResolvedValue(result)
  const onOpenJournal = vi.fn()
  render(<RestoreBackup onOpenJournal={onOpenJournal} />)
  const file = new File([JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT, entries: [{
    id: "synthetic-restore", kind: "post-session", date: "2026-10-25", savedAt: "2026-10-25T00:00:00Z", syncState: "local",
    title: "", memo: "", system: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
  }] })], "synthetic-backup.json", { type: "application/json" })
  await userEvent.setup().upload(screen.getByLabelText(/백업 파일/u), file)
  fireEvent.click(await screen.findByTestId("restore-submit"))
  await screen.findByTestId("restore-account-result")
  expect(service.confirm).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole("button", { name: "일지에서 확인하기" }))
  expect(onOpenJournal).toHaveBeenCalledOnce()
  expect(service.confirm).toHaveBeenCalledOnce()
  expect(fetch).not.toHaveBeenCalled()
})
