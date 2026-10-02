import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setActiveLocalAccount } from "../account/local-journal-ownership"
import { createEmptyDecorationState } from "../decoration-schema"
import { createEmptyCalendarDecorationState } from "../calendar-decoration-schema"
import { FULL_FORMAT_V5, readBackupFile } from "./backup-file"
import { createAccountBackupRestoration } from "./account-restore"

const api = vi.hoisted(() => ({
  journalHydrate: vi.fn(),
  decorationsHydrate: vi.fn(),
  decorationsRead: vi.fn(),
  decorationsStatus: vi.fn(),
  decorationsPersist: vi.fn(),
  calendarHydrate: vi.fn(),
  calendarRead: vi.fn(),
  calendarStatus: vi.fn(),
  calendarPersist: vi.fn(),
}))

vi.mock("../account/account-journal-record-service", () => ({
  accountJournalRecordsEnabled: () => true,
  hydrateAccountJournalRecords: api.journalHydrate,
  accountJournalDeletedDocuments: () => [],
  readAccountJournalWriteBase: async () => null,
}))
vi.mock("../account/account-decoration-service", () => ({
  accountDecorationStatus: api.decorationsStatus,
  hydrateAccountDecorations: api.decorationsHydrate,
  readAccountDecorationState: api.decorationsRead,
  persistAccountDecorations: api.decorationsPersist,
}))
vi.mock("../account/account-calendar-decoration-service", () => ({
  accountCalendarDecorationStatus: api.calendarStatus,
  hydrateAccountCalendarDecorations: api.calendarHydrate,
  readAccountCalendarDecorationState: api.calendarRead,
  persistAccountCalendarDecorations: api.calendarPersist,
}))

const decorationState = createEmptyDecorationState()
const calendarState = createEmptyCalendarDecorationState()
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function backup({ decorations = decorationState, calendar = calendarState }: { decorations?: typeof decorationState; calendar?: typeof calendarState } = {}) {
  return readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT_V5, entries: [],
    decorations, calendarDecorations: calendar }))
}

const sessions: NonNullable<Awaited<ReturnType<typeof createAccountBackupRestoration>>>[] = []
async function prepare(read = backup()) {
  const session = await createAccountBackupRestoration(read)
  expect(session).not.toBeNull()
  sessions.push(session!)
  return session!
}

beforeEach(() => {
  vi.resetAllMocks()
  setActiveLocalAccount("A")
  api.journalHydrate.mockResolvedValue(true)
  api.decorationsHydrate.mockResolvedValue(true)
  api.decorationsRead.mockReturnValue(decorationState)
  api.decorationsStatus.mockReturnValue("READY")
  api.decorationsPersist.mockResolvedValue({ ok: true, storage: "ACCOUNT", state: decorationState })
  api.calendarHydrate.mockResolvedValue(true)
  api.calendarRead.mockReturnValue(calendarState)
  api.calendarStatus.mockReturnValue("READY")
  api.calendarPersist.mockResolvedValue({ ok: true, storage: "ACCOUNT", state: calendarState })
})
afterEach(() => {
  sessions.splice(0).forEach(session => session.dispose())
  setActiveLocalAccount(null)
})

describe("account v5 calendar-decoration restoration", () => {
  it("accepts a valid calendar-only v5 backup with zero journal entries", async () => {
    const read = backup()
    expect(read.recognized).toBe(true)
    expect(read.entries).toEqual([])
    expect(read.calendarDecorationStatus).toBe("included")
    const session = await prepare(read)

    expect(session.calendarReady).toBe(true)
    expect(await session.confirm("keep-existing", "keep-existing", "replace")).toMatchObject({
      decorationRestore: "KEPT_EXISTING", calendarDecorationRestore: "ACCOUNT", calendarDecorationFailure: "NONE", commit: "COMPLETE",
    })
    expect(api.calendarPersist).toHaveBeenCalledOnce()
  })

  it("does not restore calendar references while included ownership decorations are only pending", async () => {
    const ownedBackup = backup({ decorations: decorationState })
    const session = await prepare(ownedBackup)
    api.decorationsPersist.mockResolvedValueOnce({ ok: true, storage: "PENDING", state: decorationState })

    expect(await session.confirm("keep-existing", "replace", "replace")).toMatchObject({
      decorationRestore: "PENDING", decorationFailure: "NONE",
      calendarDecorationRestore: "FAILED", calendarDecorationFailure: "OWNERSHIP_UNVERIFIED",
    })
    expect(api.calendarPersist).not.toHaveBeenCalled()

    api.decorationsPersist.mockResolvedValueOnce({ ok: true, storage: "ACCOUNT", state: decorationState })
    expect(await session.confirm()).toMatchObject({ decorationRestore: "ACCOUNT", calendarDecorationRestore: "ACCOUNT" })
    expect(api.calendarPersist).toHaveBeenCalledOnce()
  })

  it("reports calendar pending and read failure independently from kept journal-decoration state", async () => {
    const session = await prepare()
    api.calendarPersist.mockResolvedValueOnce({ ok: true, storage: "PENDING", state: calendarState })
    expect(await session.confirm("keep-existing", "keep-existing", "replace")).toMatchObject({
      decorationRestore: "KEPT_EXISTING", calendarDecorationRestore: "PENDING", calendarDecorationFailure: "NONE", commit: "PENDING",
    })

    api.calendarHydrate.mockResolvedValue(false)
    api.calendarStatus.mockReturnValue("FAILED")
    const failed = await prepare()
    expect(await failed.confirm("keep-existing", "keep-existing", "replace")).toMatchObject({
      decorationRestore: "KEPT_EXISTING", calendarDecorationRestore: "FAILED", calendarDecorationFailure: "READ_FAILED",
    })
  })

  it("keeps existing account calendar state when the review checkbox is unchecked", async () => {
    const session = await prepare()
    expect(await session.confirm("keep-existing", "keep-existing", "keep-existing")).toMatchObject({
      calendarDecorationRestore: "KEPT_EXISTING", calendarDecorationFailure: "NONE",
    })
    expect(api.calendarPersist).not.toHaveBeenCalled()
  })

  it("cancels an A-B-A account-scope switch while calendar persistence is pending", async () => {
    const session = await prepare()
    const pending = deferred<{ ok: true; storage: "ACCOUNT"; state: typeof calendarState }>()
    api.calendarPersist.mockReturnValueOnce(pending.promise)
    const work = session.confirm("keep-existing", "keep-existing", "replace")
    await vi.waitFor(() => expect(api.calendarPersist).toHaveBeenCalledOnce())
    setActiveLocalAccount("B")
    setActiveLocalAccount("A")
    pending.resolve({ ok: true, storage: "ACCOUNT", state: calendarState })
    expect(await work).toBeNull()
    expect(await session.confirm()).toBeNull()
    expect(api.calendarPersist).toHaveBeenCalledOnce()
  })
})
