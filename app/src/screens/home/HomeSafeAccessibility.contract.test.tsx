import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../../domain/journal-store"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { Home } from "../Home"
import { TrainingHome } from "./TrainingHome"

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

const HOME_MODEL_WITH_NEXT_TRAINING = {
  homeMode: "TRAINING",
  todayMessage: "아직 오늘 기록이 없어요.",
  journalSummary: "아직 기록이 없어요",
  flowSummary: "9.5일 주기로 일지 묶어 보기 · 시작일 직접 선택",
  planSummary: "저장된 계획 · 3개 일정",
  analysisSummary: "기록이 쌓이면 변화를 볼 수 있어요",
  showMinjiPrompt: true,
  briefing: "",
  nextTraining: {
    date: "2026-07-14",
    laterSameDaySession: null,
    session: {
      day: 1,
      slot: "PM",
      role: "QUALITY",
      plannedEnergyIntent: "LT_INTENT",
      prescription: {
        kind: "RPE_TIME_RANGE",
        rpe: { minimum: 5, maximum: 6 },
        durationMinutes: { minimum: 25, maximum: 40 },
      },
    },
  },
} satisfies TrainingHomeViewModel

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

  it("shows the nearest saved training as a separate route without adding another service choice", async () => {
    const user = userEvent.setup()
    const onOpenPlan = vi.fn()
    render(<TrainingHome model={HOME_MODEL_WITH_NEXT_TRAINING} onOpenPlan={onOpenPlan} />)

    const nextTraining = screen.getByRole("button", { name: /다음 훈련.*지속 페이스.*오후/u })
    expect(nextTraining).toHaveTextContent("7월 14일")
    expect(nextTraining).toHaveTextContent("총 25~40분 · RPE 5~6")
    expect(within(screen.getByRole("navigation", { name: "내 기록 살펴보기" })).getAllByRole("button")).toHaveLength(3)

    await user.click(nextTraining)

    expect(onOpenPlan).toHaveBeenCalledTimes(1)
  })

  it("shows a later same-day session without adding another service choice", () => {
    const modelWithFollowUp = {
      ...HOME_MODEL_WITH_NEXT_TRAINING,
      nextTraining: {
        ...HOME_MODEL_WITH_NEXT_TRAINING.nextTraining,
        session: {
          ...HOME_MODEL_WITH_NEXT_TRAINING.nextTraining.session,
          slot: "AM",
          role: "EASY",
          plannedEnergyIntent: "BASE_INTENT",
          prescription: {
            kind: "RPE_TIME_RANGE",
            rpe: { minimum: 3, maximum: 4 },
            durationMinutes: { minimum: 30, maximum: 45 },
          },
        },
        laterSameDaySession: {
          day: 1,
          slot: "PM",
          role: "EASY",
          plannedEnergyIntent: "RECOVERY_INTENT",
          prescription: {
            kind: "RPE_TIME_RANGE",
            rpe: { minimum: 1, maximum: 2 },
            durationMinutes: { minimum: 15, maximum: 25 },
          },
        },
      },
    } satisfies TrainingHomeViewModel

    render(<TrainingHome model={modelWithFollowUp} />)

    const nextTraining = screen.getByRole("button", {
      name: /다음 훈련.*같은 날 오후.*오후 회복 운동/u,
    })
    expect(nextTraining).toHaveTextContent("같은 날 오후 · 오후 회복 운동도 예정")
    expect(within(screen.getByRole("navigation", { name: "내 기록 살펴보기" })).getAllByRole("button")).toHaveLength(3)
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

  it("shows the welcome value, local trust, equal entry actions, and one promoted example when empty", async () => {
    const user = userEvent.setup()
    const onWriteLog = vi.fn()
    const onOpenPlan = vi.fn()
    const onOpenGuide = vi.fn()
    window.localStorage.clear()
    render(<Home onWriteLog={onWriteLog} onOpenPlan={onOpenPlan} onOpenGuide={onOpenGuide} />)

    expect(screen.getByRole("heading", {
      name: "달리기 일지를 남기고, 내 기록으로 훈련 계획을 받아요.",
    })).toBeVisible()
    expect(screen.getByText("모든 데이터는 이 기기에만 저장돼요.")).toBeVisible()
    const writeLog = screen.getByRole("button", { name: "오늘 기록 남기기" })
    const openPlan = screen.getByRole("button", { name: "훈련 계획 만들기" })
    const openGuide = screen.getByRole("button", { name: "민지의 예시 일지 보기" })
    // 최종 폴리시 D1: 기록 CTA만 프라이머리, 계획 CTA는 세컨더리(아웃라인) — "일지 먼저" 위계
    expect(writeLog).toHaveClass("training-home__primary")
    expect(openPlan).toHaveClass("training-home__secondary")
    expect(writeLog.parentElement).toBe(openPlan.parentElement)
    expect(screen.getByText("이렇게 쓰여요")).toBeVisible()
    expect(screen.queryByRole("region", { name: "오늘의 기분 몸 상태 날씨" })).toBeNull()
    expect(screen.queryByRole("button", { name: "하루 마무리 기록하기" })).toBeNull()
    expect(screen.queryByRole("region", { name: "최근 기록" })).toBeNull()
    expect(screen.queryByText("기록이 쌓이면 어떻게 보일까요?")).toBeNull()
    expect(screen.queryByText(/일지 꾸미기/u)).toBeNull()
    expect(screen.getByRole("region", { name: "기록 습관" })).toBeVisible()
    const services = screen.getByRole("navigation", { name: "내 기록 살펴보기" })
    expect(within(services).getAllByRole("button")).toHaveLength(3)
    expect(openGuide.compareDocumentPosition(services) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(services.compareDocumentPosition(screen.getByRole("region", { name: "기록 습관" }))
      & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)

    await user.click(writeLog)
    await user.click(openPlan)
    await user.click(openGuide)

    expect(onWriteLog).toHaveBeenCalledWith("post-session")
    expect(onOpenPlan).toHaveBeenCalledTimes(1)
    expect(onOpenGuide).toHaveBeenCalledTimes(1)
  })

  it("keeps today context available in journal mode", async () => {
    // Given
    const user = userEvent.setup()
    render(<Home />)

    // When
    await user.click(screen.getByRole("button", { name: "날씨 맑음" }))

    // Then
    expect(screen.getByRole("button", { name: "날씨 맑음" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "오늘의 기분 몸 상태 날씨" })).toHaveTextContent("위치정보를 사용하지 않아요")
  })

  it("places journal-mode today context inside today before all secondary sections", () => {
    // Given
    render(<Home />)
    const todayJournal = screen.getByLabelText("오늘")
    const context = screen.getByRole("region", { name: "오늘의 기분 몸 상태 날씨" })
    const services = screen.getByRole("navigation", { name: "내 기록 살펴보기" })

    // When
    const contextInTodayJournal = todayJournal.contains(context)
    const contextBeforeServices = context.compareDocumentPosition(services)

    // Then
    expect(contextInTodayJournal).toBe(true)
    expect(contextBeforeServices & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })
})
