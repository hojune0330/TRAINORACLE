import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { loadEntriesWithPrivateMemos, exportEntriesJSON } from "./journal-store"
import { JOURNAL_STORAGE_KEY } from "./journal-local-storage"
import { privateEntry } from "./private-memo-test-fixtures"
import { createRecoveryCode } from "./account/private-note-crypto"
import { saveSessionRecoveryCode } from "./account/private-note-sync"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { putAccountJournalProjection, resetAccountJournalProjection } from "./account/account-journal-projection"
import { restorePrivateMemo } from "./private-memo-vault"

vi.mock("./private-memo-vault", async original => ({
  ...await original<typeof import("./private-memo-vault")>(),
  restorePrivateMemo: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true")
  vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
  setActiveLocalAccount("A")
  resetAccountJournalProjection("A")
  expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
})
afterEach(() => {
  resetAccountJournalProjection(null)
  setActiveLocalAccount(null)
  vi.unstubAllEnvs()
})

it.each(["B", "logout", "ABA", "guestABA"])("revokes the entire private read and staged cache on %s", async mode => {
  if (mode === "guestABA") {
    setActiveLocalAccount(null); resetAccountJournalProjection(null)
    expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
  }
  const first = privateEntry("p", ""), second = privateEntry("q", "")
  window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([first, second]))
  if (mode !== "guestABA") putAccountJournalProjection("A", privateEntry("a", "SYNTHETIC_ACCOUNT_PRIVATE"))
  const originals = { ...window.localStorage }
  let finish!: (entry: typeof second) => void
  vi.mocked(restorePrivateMemo).mockImplementation(async (_storage, entry) => entry)
    .mockResolvedValueOnce({ ...first, memo: "SYNTHETIC_FIRST_PRIVATE" })
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = loadEntriesWithPrivateMemos()
  await vi.waitFor(() => expect(restorePrivateMemo).toHaveBeenCalledTimes(2))
  setActiveLocalAccount(mode === "logout" ? null : "B")
  if (mode === "ABA") setActiveLocalAccount("A")
  if (mode === "guestABA") setActiveLocalAccount(null)
  finish({ ...second, memo: "SYNTHETIC_LATE_PRIVATE" })
  expect(await pending).toEqual([])
  expect({ ...window.localStorage }).toEqual(originals)
  // The earlier successful decryption must not warm the export cache either.
  setActiveLocalAccount(mode === "guestABA" ? null : "A")
  resetAccountJournalProjection(null)
  window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([first]))
  expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow()
})

it("keeps same-owner legacy and account private reads working", async () => {
  const shell = privateEntry("s", ""), full = { ...shell, memo: "SYNTHETIC_STABLE_PRIVATE" }
  const online = privateEntry("a", "SYNTHETIC_ACCOUNT_PRIVATE")
  window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([shell]))
  putAccountJournalProjection("A", online)
  vi.mocked(restorePrivateMemo).mockResolvedValueOnce(full)
  expect(await loadEntriesWithPrivateMemos()).toEqual([full, online])
  expect(JSON.parse(exportEntriesJSON({ includeRawMemos: true })).entries).toEqual([full, online])
})
