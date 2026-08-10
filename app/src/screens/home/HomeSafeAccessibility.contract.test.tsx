import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../../domain/journal-store"
import { Home } from "../Home"

const STORAGE_KEY = "trainoracle.journal.v1"

const RECENT_ENTRY = {
  id: "recent-session",
  kind: "post-session",
  date: "2026-07-14",
  savedAt: "2026-07-14T08:00:00.000Z",
  syncState: "local",
  system: "lt",
  title: "시드 템포런",
  distanceKm: "8",
  durationMin: "40",
  avgPace: "5:00",
  rpe: 6,
  memo: "비공개 원문",
  memoPurpose: "PRIVATE_SELF_ONLY",
} satisfies JournalEntry

const PRIVATE_EVENING_ENTRY = {
  id: "private-evening",
  kind: "evening",
  date: "2026-07-15",
  savedAt: "2026-07-15T21:00:00.000Z",
  syncState: "local",
  sleepH: 0,
  sleepQuality: 0,
  weightKg: "",
  restingHr: "",
  painParts: {},
  mood: 0,
  note: "저녁 비공개 원문",
  memoPurpose: "PRIVATE_SELF_ONLY",
} satisfies JournalEntry

afterEach(cleanup)

describe("home journal controls", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([RECENT_ENTRY]))
  })

  it("opens a recent journal entry through a semantic labeled button", async () => {
    // Given
    const user = userEvent.setup()
    const onOpenDay = vi.fn()
    render(<Home onOpenDay={onOpenDay} />)
    const recentEntry = screen.getByRole("button", { name: /훈련 후.*시드 템포런.*상세/u })

    // When
    await user.click(recentEntry)

    // Then
    expect(onOpenDay).toHaveBeenCalledWith("2026-07-14")
  })

  it("uses a diary-friendly date on a recent entry while keeping its full date accessible", () => {
    // Given
    render(<Home />)
    const recentEntry = screen.getByRole("button", { name: /훈련 후.*시드 템포런.*상세/u })

    // When
    const visibleDate = screen.getByText("7월 14일")

    // Then
    expect(visibleDate).toBeVisible()
    expect(recentEntry).toHaveAccessibleName(/2026년 7월 14일.*훈련 후.*시드 템포런/u)
  })

  it("centers the first screen on the user's records and keeps service choices to three", () => {
    render(<Home />)

    expect(screen.getByRole("heading", { name: "내 기록" })).toBeVisible()
    expect(screen.getByText("오늘을 남기고, 필요할 때 훈련을 더 자세히 봐요.")).toBeVisible()
    expect(screen.getByRole("button", { name: "오늘 기록하기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "하루 마무리 기록하기" })).toBeVisible()
    expect(screen.getByRole("button", { name: /내 일지.*1일.*1개의 기록/u })).toBeVisible()
    expect(screen.getByRole("button", { name: /훈련 계획/u })).toBeVisible()
    expect(screen.getByRole("button", { name: /분석/u })).toBeVisible()
    expect(screen.getByText("일지 꾸미기 · 사용 가능 4P")).toBeVisible()
    const serviceChoices = within(screen.getByRole("navigation", { name: "내 기록 살펴보기" })).getAllByRole("button")
    expect(serviceChoices).toHaveLength(3)
    expect(screen.queryByRole("button", { name: /훈련 흐름/u })).toBeNull()
    expect(screen.queryByText("비공개 원문")).toBeNull()
  })

  it("places a recent journal entry before services and decoration so returning athletes can continue reading first", () => {
    // Given
    render(<Home />)
    const recentEntry = screen.getByRole("button", { name: /훈련 후.*시드 템포런.*상세/u })
    const services = screen.getByRole("navigation", { name: "내 기록 살펴보기" })
    const decorationEntry = screen.getByText("일지 꾸미기 · 사용 가능 4P")

    // When
    const servicesPosition = recentEntry.compareDocumentPosition(services)
    const decorationPosition = recentEntry.compareDocumentPosition(decorationEntry)

    // Then
    expect(servicesPosition & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(decorationPosition & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it("never uses a private evening note as visible or accessible recent-entry text", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([RECENT_ENTRY, PRIVATE_EVENING_ENTRY]))

    render(<Home />)

    expect(document.body.textContent).not.toContain("저녁 비공개 원문")
    expect(screen.queryByRole("button", { name: /저녁 비공개 원문/u })).toBeNull()
  })

  it("shows a pain review only for explicit pain, not imported derived pain", () => {
    const eveningBase = {
      ...PRIVATE_EVENING_ENTRY,
      note: "",
      memoPurpose: undefined,
      painParts: { knee: 5 },
      date: "2099-01-01",
    } satisfies JournalEntry
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{
      ...eveningBase,
      id: "derived-pain",
      fieldProvenance: {
        painParts: {
          provenance: "DERIVED",
          derivedFrom: ["import:activity-file"],
          derivationRuleId: "import.activity-file.v1",
        },
      },
    } satisfies JournalEntry]))

    const { unmount } = render(<Home />)
    expect(screen.queryByTestId("home-pain-review")).toBeNull()
    unmount()

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{
      ...eveningBase,
      id: "explicit-pain",
      fieldProvenance: { painParts: { provenance: "EXPLICIT" } },
    } satisfies JournalEntry]))
    render(<Home />)
    expect(screen.getByTestId("home-pain-review")).toBeVisible()
  })

  it("shows the real dashboard instead of a blocking welcome screen when empty", () => {
    window.localStorage.clear()
    render(<Home />)

    const heading = screen.getByRole("heading", { name: "내 기록" })
    const context = screen.getByRole("region", { name: "오늘의 기분 몸 상태 날씨" })
    expect(heading.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(screen.getByText("아직 오늘 기록이 없어요.")).toBeVisible()
    expect(screen.getByRole("button", { name: /내 일지.*아직 기록이 없어요/u })).toBeVisible()
    expect(screen.queryByText("오늘 기록을 시작할까요?")).toBeNull()
  })
})
