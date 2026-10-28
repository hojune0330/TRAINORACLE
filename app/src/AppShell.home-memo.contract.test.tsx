import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { HomeProps } from "./screens/Home"
import type { LogEntryProps } from "./screens/LogEntry"
import * as journalStore from "./domain/journal-store"
import { deleteEntry, saveEntry, updateEntry, type JournalEntry } from "./domain/journal-store"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { initializeCanonicalJournalFixture } from "./test/canonical-journal-fixture"
import { hasUnsafeDrafts, registerUnsavedDraftGuard } from "./domain/unsaved-draft-navigation"

const state = vi.hoisted(() => ({ props: null as HomeProps | null, review: undefined as string | undefined,
  entry: { id: "home-memo-target", kind: "evening", date: "2026-10-25", savedAt: "2026-10-25T08:00:00Z", syncState: "local",
    sleepH: 0, sleepQuality: 0, weightKg: "", restingHr: "", painParts: {}, mood: 0, note: "synthetic private plaintext", memoPurpose: "PRIVATE_SELF_ONLY" } as JournalEntry }))
vi.mock("./screens/Home", () => ({ Home: (props: HomeProps) => {
  state.props = props
  return <><button onClick={() => { expect(saveEntry({ ...state.entry, note: "" }).ok).toBe(true); props.onMemoSaved?.(state.entry, state.review) }}>save memo</button>
    {props.memoReceipt && <><output aria-label="recent receipt">{JSON.stringify(props.memoReceipt)}</output>
      <button onClick={props.onOpenMemoRecord}>recent view</button>
      {!props.memoReceipt.review && <button onClick={props.onDecorateMemo}>recent decorate</button>}</>}
    {props.memoNotice && <p role="alert">{props.memoNotice}</p>}</>
} }))
vi.mock("./DeferredMobileScreens", () => ({ DeferredMobileScreens: { PlanProposalInbox: () => null,
  JournalDayReader: ({ initialEntryId, date, onBack, onEditEntry }: { initialEntryId?: string; date: string; onBack: () => void; onEditEntry: (entry: JournalEntry) => void }) =>
    <><output aria-label="reader id">{initialEntryId}</output><output aria-label="reader date">{date}</output><button onClick={onBack}>reader back</button><button onClick={() => onEditEntry(state.entry)}>reader edit</button></>,
  JournalRewards: ({ initialDate, onBack }: { initialDate?: string; onBack: () => void }) => <><output aria-label="decoration date">{initialDate}</output><button onClick={onBack}>decoration back</button></>,
} }))
vi.mock("./screens/LogEntry", () => ({ LogEntry: ({ onDone }: LogEntryProps) => <button onClick={() => {
  const next = { ...state.entry, note: "", savedAt: "2026-10-25T09:00:00Z" } as JournalEntry
  expect(updateEntry(next, state.entry.savedAt).ok).toBe(true)
  onDone?.("evening", next, "수정 후 몸 상태 확인 필요", "합성 확정 저장")
}}>save reviewed edit</button> }))
import { AppShell } from "./AppShell"

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); await initializeCanonicalJournalFixture()
  state.review = undefined; state.props = null
  window.history.replaceState(null, "", "/?app=1")
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.restoreAllMocks() })

it("keeps metadata across exact record view and home return without retaining private plaintext", () => {
  render(<AppShell />)
  fireEvent.click(screen.getByText("save memo"))
  expect(screen.getByLabelText("recent receipt")).not.toHaveTextContent("synthetic private plaintext")
  fireEvent.click(screen.getByText("recent view"))
  expect(screen.getByLabelText("reader id")).toHaveTextContent(state.entry.id)
  expect(screen.getByLabelText("reader date")).toHaveTextContent(state.entry.date)
  fireEvent.click(screen.getByText("reader back"))
  expect(screen.getByLabelText("recent receipt")).toHaveTextContent(state.entry.id)
})

it.each(["deleted", "modified"])("refuses a %s target even when another entry exists on the same date", change => {
  render(<AppShell />); fireEvent.click(screen.getByText("save memo"))
  act(() => {
    expect(saveEntry({ ...state.entry, id: "same-date-other", note: "" }).ok).toBe(true)
    if (change === "deleted") expect(deleteEntry(state.entry.id).ok).toBe(true)
    else expect(updateEntry({ ...state.entry, note: "", savedAt: "2026-10-25T09:00:00Z" }, state.entry.savedAt).ok).toBe(true)
  })
  fireEvent.click(screen.getByText("recent view"))
  expect(screen.queryByLabelText("reader id")).toBeNull()
  expect(screen.getByRole("alert")).toHaveTextContent("기록이 바뀌었어요")
})

it("opens the saved date in decoration and restores the same receipt on return", () => {
  render(<AppShell />); fireEvent.click(screen.getByText("save memo"))
  fireEvent.click(screen.getByText("recent decorate"))
  expect(screen.getByLabelText("decoration date")).toHaveTextContent(state.entry.date)
  fireEvent.click(screen.getByText("decoration back"))
  expect(screen.getByLabelText("recent receipt")).toHaveTextContent(state.entry.id)
})

function invalidateTarget(change: "deleted" | "modified" | "unavailable") {
  if (change === "deleted") expect(deleteEntry(state.entry.id).ok).toBe(true)
  else if (change === "modified") expect(updateEntry({ ...state.entry, note: "", savedAt: "2026-10-25T09:00:00Z" }, state.entry.savedAt).ok).toBe(true)
  else {
    const snapshot = journalStore.loadJournalEntriesSnapshot()
    vi.spyOn(journalStore, "loadJournalEntriesSnapshot").mockReturnValue({ ...snapshot, readStatus: "uncertain" })
  }
}

function expectNoMemoDestination() {
  expect(screen.queryByLabelText("reader id")).toBeNull()
  expect(screen.queryByLabelText("decoration date")).toBeNull()
}

it("confirms a dirty draft and opens only the exact saved target among same-date entries", () => {
  render(<AppShell />); fireEvent.click(screen.getByText("save memo"))
  act(() => { expect(saveEntry({ ...state.entry, id: "same-date-other", note: "" }).ok).toBe(true) })
  let dirty = true
  const confirmDiscard = vi.fn(() => true), discard = vi.fn(() => { dirty = false })
  const unregister = registerUnsavedDraftGuard({ isUnsafe: () => dirty, onBlocked: vi.fn(), confirmDiscard, discard })
  try {
    fireEvent.click(screen.getByText("recent view"))
    expect(confirmDiscard).toHaveBeenCalledTimes(1); expect(discard).toHaveBeenCalledTimes(1)
    expect(hasUnsafeDrafts()).toBe(false)
    expect(screen.getByLabelText("reader id")).toHaveTextContent(state.entry.id)
    expect(screen.getByLabelText("reader id")).not.toHaveTextContent("same-date-other")
  } finally { unregister() }
})

it.each([
  ["recent view", "deleted"], ["recent view", "modified"], ["recent view", "unavailable"],
  ["recent decorate", "deleted"], ["recent decorate", "modified"], ["recent decorate", "unavailable"],
] as const)("preserves a dirty guest draft before %s when the target is already %s", (action, change) => {
  render(<AppShell />); fireEvent.click(screen.getByText("save memo"))
  act(() => {
    expect(saveEntry({ ...state.entry, id: "same-date-other", note: "" }).ok).toBe(true)
    invalidateTarget(change)
  })
  const confirmDiscard = vi.fn(() => true), discard = vi.fn()
  const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), confirmDiscard, discard })
  try {
    fireEvent.click(screen.getByText(action))
    expect(confirmDiscard, change).not.toHaveBeenCalled(); expect(discard, change).not.toHaveBeenCalled()
    expect(hasUnsafeDrafts(), change).toBe(true); expectNoMemoDestination()
    expect(screen.getByRole("alert")).toHaveTextContent(change === "unavailable" ? "기록을 확인하지 못했어요" : "기록이 바뀌었어요")
  } finally { unregister() }
})

it.each(["deleted", "modified", "unavailable"] as const)("keeps the draft when the exact target becomes %s during confirmation", change => {
  render(<AppShell />); fireEvent.click(screen.getByText("save memo"))
  const discard = vi.fn(), confirmDiscard = vi.fn(() => { invalidateTarget(change); return true })
  const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), confirmDiscard, discard })
  try {
    fireEvent.click(screen.getByText("recent view"))
    expect(confirmDiscard).toHaveBeenCalledTimes(1); expect(discard).not.toHaveBeenCalled()
    expect(hasUnsafeDrafts()).toBe(true); expectNoMemoDestination()
    expect(screen.getByRole("alert")).toHaveTextContent(change === "unavailable" ? "기록을 확인하지 못했어요" : "기록이 바뀌었어요")
  } finally { unregister() }
})

it.each(["deleted", "modified", "unavailable"] as const)("rechecks a %s target before a deferred resume can discard another draft", change => {
  render(<AppShell />); fireEvent.click(screen.getByText("save memo"))
  let resume: (() => void) | undefined, deciding = true
  const unregisterDecision = registerUnsavedDraftGuard({ isUnsafe: () => deciding, onBlocked: vi.fn(), requestNavigation: next => { resume = next } })
  const confirmDiscard = vi.fn(() => true), discard = vi.fn()
  const unregisterDirty = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), confirmDiscard, discard })
  try {
    fireEvent.click(screen.getByText("recent decorate")); expect(resume).toBeTypeOf("function")
    expect(confirmDiscard).not.toHaveBeenCalled(); expect(discard).not.toHaveBeenCalled()
    act(() => { invalidateTarget(change); deciding = false; resume!() })
    expect(confirmDiscard).not.toHaveBeenCalled(); expect(discard).not.toHaveBeenCalled()
    expect(hasUnsafeDrafts()).toBe(true); expectNoMemoDestination()
    expect(screen.getByRole("alert")).toHaveTextContent(change === "unavailable" ? "기록을 확인하지 못했어요" : "기록이 바뀌었어요")
  } finally { unregisterDecision(); unregisterDirty() }
})

it.each(["confirm", "deferred"])("invalidates %s navigation across an account round trip without a stale notice", mode => {
  render(<AppShell />); fireEvent.click(screen.getByText("save memo"))
  let resume: (() => void) | undefined
  const switchAccount = () => { setActiveLocalAccount("synthetic-other"); setActiveLocalAccount(null) }
  const discard = vi.fn()
  const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), discard,
    ...(mode === "confirm" ? { confirmDiscard: () => { switchAccount(); return true } } : { requestNavigation: (next: () => void) => { resume = next } }) })
  try {
    fireEvent.click(screen.getByText("recent view"))
    if (mode === "deferred") { expect(resume).toBeTypeOf("function"); act(() => { switchAccount(); resume!() }) }
    expect(discard).not.toHaveBeenCalled(); expect(hasUnsafeDrafts()).toBe(true)
    expectNoMemoDestination(); expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByLabelText("recent receipt")).toBeNull()
  } finally { unregister() }
})

it.each(["cancel", "blocked"])("preserves the existing %s draft decision for a valid target", mode => {
  render(<AppShell />); fireEvent.click(screen.getByText("save memo"))
  const onBlocked = vi.fn(), discard = vi.fn(), confirmDiscard = vi.fn(() => false)
  const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked, discard, ...(mode === "cancel" ? { confirmDiscard } : {}) })
  try {
    fireEvent.click(screen.getByText("recent view"))
    expect(discard).not.toHaveBeenCalled(); expect(hasUnsafeDrafts()).toBe(true); expectNoMemoDestination()
    if (mode === "cancel") expect(confirmDiscard).toHaveBeenCalledTimes(1)
    else expect(onBlocked).toHaveBeenCalledTimes(1)
  } finally { unregister() }
})

it("distinguishes an uncertain read from deletion without opening a cached target", () => {
  render(<AppShell />); fireEvent.click(screen.getByText("save memo"))
  const snapshot = journalStore.loadJournalEntriesSnapshot()
  vi.spyOn(journalStore, "loadJournalEntriesSnapshot").mockReturnValue({ ...snapshot, readStatus: "uncertain" })
  fireEvent.click(screen.getByText("recent view"))
  expect(screen.queryByLabelText("reader id")).toBeNull()
  expect(screen.getByRole("alert")).toHaveTextContent("기록을 확인하지 못했어요")
})

it("preserves a dirty draft when resolving the exact target throws", () => {
  render(<AppShell />); fireEvent.click(screen.getByText("save memo"))
  vi.spyOn(journalStore, "loadJournalEntriesSnapshot").mockImplementation(() => { throw new Error("synthetic unavailable read") })
  const confirmDiscard = vi.fn(() => true), discard = vi.fn()
  const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), confirmDiscard, discard })
  try {
    fireEvent.click(screen.getByText("recent view"))
    expect(confirmDiscard).not.toHaveBeenCalled(); expect(discard).not.toHaveBeenCalled()
    expect(hasUnsafeDrafts()).toBe(true); expectNoMemoDestination()
    expect(screen.getByRole("alert")).toHaveTextContent("기록을 확인하지 못했어요")
  } finally { unregister() }
})

it("updates an exact existing edit with its version and review together", () => {
  render(<AppShell />); fireEvent.click(screen.getByText("save memo"))
  fireEvent.click(screen.getByText("recent view")); fireEvent.click(screen.getByText("reader edit"))
  fireEvent.click(screen.getByText("save reviewed edit"))
  fireEvent.click(screen.getByText("reader back"))
  expect(state.props!.memoReceipt).toMatchObject({ id: state.entry.id, savedAt: "2026-10-25T09:00:00Z", review: "수정 후 몸 상태 확인 필요", storage: "합성 확정 저장", storageStatus: "LOCAL" })
})

it("blocks review decoration in the handler and clears receipts on A to B to A scope changes", () => {
  state.review = "몸 상태 확인 필요"
  render(<AppShell />); fireEvent.click(screen.getByText("save memo"))
  const decorate = state.props!.onDecorateMemo!
  expect(screen.queryByText("recent decorate")).toBeNull()
  const confirmDiscard = vi.fn(() => true), discard = vi.fn()
  const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), confirmDiscard, discard })
  try {
    act(() => decorate())
    expect(screen.getByLabelText("recent receipt")).toBeVisible()
    act(() => { setActiveLocalAccount("synthetic-other"); setActiveLocalAccount(null) })
    expect(screen.queryByLabelText("recent receipt")).toBeNull()
    act(() => decorate())
    expect(screen.queryByLabelText("recent receipt")).toBeNull()
    expect(confirmDiscard).not.toHaveBeenCalled(); expect(discard).not.toHaveBeenCalled()
    expect(hasUnsafeDrafts()).toBe(true); expectNoMemoDestination()
  } finally { unregister() }
})
