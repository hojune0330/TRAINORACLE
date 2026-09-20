import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OracleBookmark } from "./OracleBookmark"
import { OraclePlanReviewButton } from "./OraclePlanReviewButton"
import { OracleResume } from "./OracleResume"
import { recordOracleJournalParticipation } from "../domain/oracle-participation"
import { createOracleReturnStore } from "../domain/oracle-return-state"
import type { PostSessionEntry } from "../domain/journal-schema"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"

const resumeFingerprint = vi.hoisted(() => ({ value: "b".repeat(32) }))
vi.mock("../domain/oracle-personal-result", () => ({
  buildOraclePersonalResult: vi.fn(() => ({ fingerprint: resumeFingerprint.value })),
}))

const today = "2026-09-21"
const scope = () => ({ kind: "guest" as const })
const storeForTest = () => createOracleReturnStore({ storage: window.localStorage, scope, today: () => today })
const fingerprintA = "a".repeat(32)

function optInWithDays() {
  const store = storeForTest()
  expect(store.enableOptIn().ok).toBe(true)
  expect(store.setParticipationWeekdays([1]).ok).toBe(true)
  return store
}

const structuredEntry: PostSessionEntry = {
  id: "entry-structured",
  kind: "post-session",
  date: today,
  savedAt: `${today}T08:00:00.000Z`,
  syncState: "local",
  system: "run",
  title: "훈련",
  distanceKm: "5",
  durationMin: "30",
  avgPace: "6:00",
  rpe: 0,
  memo: "",
  fieldProvenance: { distanceKm: { provenance: "EXPLICIT" } },
}

const privateOnlyEntry: PostSessionEntry = {
  ...structuredEntry,
  id: "entry-private",
  distanceKm: "",
  durationMin: "",
  avgPace: "",
  memo: "개인 메모",
  memoPurpose: "PRIVATE_SELF_ONLY",
  fieldProvenance: {},
}

describe("Oracle participation integration contracts", () => {
  beforeEach(() => {
    cleanup()
    window.localStorage.clear()
    window.sessionStorage.clear()
    setActiveLocalAccount(null)
    resumeFingerprint.value = "b".repeat(32)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    setActiveLocalAccount(null)
  })

  it("does not write bookmark storage until the explicit opt-in click", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    const user = userEvent.setup()
    render(<OracleBookmark topicId="level" />)
    expect(setItem.mock.calls.filter(([key]) => !String(key).includes("__to_probe__"))).toHaveLength(0)
    await user.click(screen.getByRole("button", { name: "관심 주제로 저장" }))
    expect(storeForTest().read().state.savedTopicIds).toEqual(["level"])
    expect(screen.getByRole("status")).toHaveTextContent("홈에서 다시 볼 수 있어요.")
  })

  it("reports storage failure honestly and clears feedback when the account scope changes", async () => {
    const user = userEvent.setup()
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota") })
    render(<OracleBookmark topicId="level" />)
    await user.click(screen.getByRole("button", { name: "관심 주제로 저장" }))
    expect(screen.getByRole("status")).toHaveTextContent("이 기기에 저장하지 못했어요")
    setItem.mockRestore()
    setActiveLocalAccount("account-b")
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument())
    expect(storeForTest().read().state.savedTopicIds).toEqual([])
  })

  it("acknowledges only the fingerprint supplied while the personal result is visible", async () => {
    const store = storeForTest()
    store.enableOptIn()
    store.saveInterest("level")
    store.markTopicSeen("level", fingerprintA)
    render(<OracleBookmark topicId="level" fingerprint={"c".repeat(32)} />)
    await waitFor(() => expect(storeForTest().isTopicUnread("level", "c".repeat(32))).toBe(false))
    expect(storeForTest().read().state.lastSeenAnalysisFingerprints.level).toBe("c".repeat(32))
  })

  it("shows Resume new only when the saved topic fingerprint changes", async () => {
    const store = storeForTest()
    store.enableOptIn()
    store.saveInterest("level")
    store.markTopicSeen("level", fingerprintA)
    render(<OracleResume onOpenTopic={vi.fn()} compact />)
    expect(await screen.findByText("업데이트")).toBeInTheDocument()
    resumeFingerprint.value = fingerprintA
    window.dispatchEvent(new Event("trainoracle:account-journals-changed"))
    await waitFor(() => expect(screen.queryByText("업데이트")).not.toBeInTheDocument())
  })

  it("counts a structured journal save but not a private-only memo", () => {
    const store = optInWithDays()
    expect(recordOracleJournalParticipation(structuredEntry, store)?.ok).toBe(true)
    expect(store.getParticipationSummary().cumulative).toBe(1)
    expect(recordOracleJournalParticipation(privateOnlyEntry, store)).toBeNull()
    expect(store.getParticipationSummary().cumulative).toBe(1)
  })

  it("does not count PlanReviewButton on mount or view; click records exactly once", async () => {
    const store = optInWithDays()
    const user = userEvent.setup()
    render(<OraclePlanReviewButton />)
    expect(store.getParticipationSummary().cumulative).toBe(0)
    await user.click(screen.getByRole("button", { name: "계획을 읽고 확인했어요" }))
    expect(store.getParticipationSummary().cumulative).toBe(1)
    expect(screen.getByRole("status")).toHaveTextContent("오늘 확인한 날로 남겼어요.")
  })
})
