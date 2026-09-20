import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { todayISO, type JournalEntry } from "../../domain/journal-store"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { Home } from "../Home"
import { TrainingHome } from "./TrainingHome"

const projection = vi.hoisted(() => ({ status: "IDLE" }))
vi.mock("../../domain/account/account-journal-projection", async importOriginal => ({
  ...await importOriginal<typeof import("../../domain/account/account-journal-projection")>(),
  accountJournalProjectionStatus: () => projection.status,
}))
const STORAGE_KEY = "trainoracle.journal.v1"
const RECENT_ENTRY = {
  id: "recent-session", kind: "post-session", date: "2026-07-14",
  savedAt: "2026-07-14T08:00:00.000Z", syncState: "local", system: "lt",
  title: "시드 템포런", distanceKm: "8", durationMin: "40", avgPace: "5:00",
  rpe: 6, memo: "비공개 원문", memoPurpose: "PRIVATE_SELF_ONLY",
} satisfies JournalEntry
const EVENING = {
  id: "private-evening", kind: "evening", date: "2026-07-14",
  savedAt: "2026-07-14T21:00:00.000Z", syncState: "local",
  sleepH: 0, sleepQuality: 0, weightKg: "", restingHr: "",
  painParts: {}, mood: 0, note: "저녁 비공개 원문", memoPurpose: "PRIVATE_SELF_ONLY",
} satisfies JournalEntry
const TRAINING = {
  homeMode: "TRAINING", todayMessage: "아직 오늘 기록이 없어요.", todayRecordCount: 0,
  journalSummary: "아직 기록이 없어요", flowSummary: "", planSummary: "저장된 계획 · 3개 일정",
  analysisSummary: "기록이 쌓이면 변화를 볼 수 있어요", showMinjiPrompt: true, briefing: "",
  nextTraining: {
    date: "2026-07-14", laterSameDaySession: null,
    session: { day: 1, slot: "PM", role: "QUALITY", plannedEnergyIntent: "LT_INTENT",
      prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 5, maximum: 6 },
        durationMinutes: { minimum: 25, maximum: 40 } } },
  },
} satisfies TrainingHomeViewModel

afterEach(cleanup)
beforeEach(() => {
  projection.status = "IDLE"
  localStorage.clear()
  localStorage.setItem(STORAGE_KEY, JSON.stringify([RECENT_ENTRY]))
})

describe("home hub destinations and information", () => {
  it("groups several kinds of journal into one dated destination without exposing private text", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      RECENT_ENTRY, { ...RECENT_ENTRY, id: "pm-session" }, EVENING,
      { ...RECENT_ENTRY, id: "older", date: "2026-07-13" },
    ]))
    const onOpenDay = vi.fn(), onOpenArchive = vi.fn()
    render(<Home onOpenDay={onOpenDay} onOpenArchive={onOpenArchive} />)
    const day = screen.getByRole("button", { name: "2026년 7월 14일 기록 3개 보기 · 훈련 2 · 하루 마무리 1" })
    expect(day).toHaveTextContent("7월 14일 기록 3개")
    expect(day).toHaveTextContent("이 기기에만 있는 기록 3개")
    fireEvent.click(day)
    fireEvent.click(screen.getByRole("button", { name: "전체 일지" }))
    expect(onOpenDay).toHaveBeenCalledWith("2026-07-14")
    expect(onOpenArchive).toHaveBeenCalledOnce()
    expect(screen.queryAllByRole("button", { name: /기록 3개 보기/ })).toHaveLength(1)
    expect(document.body.textContent).not.toContain("비공개 원문")
    expect(screen.queryByRole("button", { name: /비공개 원문/ })).toBeNull()
  })

  it("keeps imported provenance on a grouped day without implying every entry is account-saved", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{
      ...RECENT_ENTRY,
      fieldProvenance: { distanceKm: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "import.activity-file.v1" } },
    }]))
    render(<Home />)
    const day = screen.getByRole("button", { name: /2026년 7월 14일 기록 1개 보기/ })
    expect(day).toHaveTextContent("가져온 기록 포함")
    expect(day).toHaveTextContent("이 기기에만 있는 기록 1개")
    expect(day).not.toHaveTextContent("계정 보관")
  })

  it("keeps learning and decorating visible while detailed rewards and graphs leave home", () => {
    const learn = vi.fn(), decorate = vi.fn()
    render(<Home onOpenContent={learn} onOpenRewards={decorate} />)
    expect(screen.getByRole("button", { name: "오늘 기록하기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "하루 마무리 기록하기" })).toBeVisible()
    expect(screen.getByRole("button", { name: /훈련 계획 만들기/ })).toBeVisible()
    const analysis = screen.getByRole("button", { name: /훈련 분석 보기/ })
    const recent = screen.getByRole("region", { name: "최근 하루 기록" })
    expect(recent.compareDocumentPosition(analysis) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    fireEvent.click(screen.getByRole("button", { name: "훈련 배우기" }))
    fireEvent.click(screen.getByRole("button", { name: "일지 꾸미기" }))
    expect(learn).toHaveBeenCalledOnce()
    expect(decorate).toHaveBeenCalledOnce()
    expect(screen.queryByRole("region", { name: "기록 습관" })).toBeNull()
    expect(screen.queryByText(/꾸미기 보관함/)).toBeNull()
    expect(document.querySelector(".energy-ledger")).toBeNull()
  })

  it("keeps another recording action after today's first entry without marking all training complete", () => {
    const today = todayISO()
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...RECENT_ENTRY, date: today, savedAt: today + "T08:00:00.000Z" }]))
    const onOpenDay = vi.fn(), onWriteLog = vi.fn()
    render(<Home onOpenDay={onOpenDay} onWriteLog={onWriteLog} />)
    expect(screen.getByText("오늘 남긴 기록 1개")).toBeVisible()
    expect(screen.queryByRole("button", { name: "오늘 기록하기" })).toBeNull()
    expect(screen.queryByRole("region", { name: "오늘의 기분 몸 상태 날씨" })).toBeNull()
    expect(screen.queryByText("오늘 훈련을 모두 마쳤어요")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "오늘 기록 보기" }))
    fireEvent.click(screen.getByRole("button", { name: "기록 더 남기기" }))
    expect(onOpenDay).toHaveBeenCalledWith(today)
    expect(onWriteLog).toHaveBeenCalledWith()
  })

  it("preserves the exact saved next training and the optional same-day follow-up", () => {
    const openNext = vi.fn(), openPlan = vi.fn()
    const model = { ...TRAINING, nextTraining: { ...TRAINING.nextTraining, laterSameDaySession: {
      ...TRAINING.nextTraining.session, role: "EASY", plannedEnergyIntent: "RECOVERY_INTENT",
    } } } satisfies TrainingHomeViewModel
    render(<TrainingHome model={model} onOpenNextTraining={openNext} onOpenPlan={openPlan} />)
    const next = screen.getByRole("button", { name: /^다음 훈련 ·/ })
    expect(next).toHaveAccessibleName(/7월 14일.*오후.*총 25~40분.*RPE 5~6/)
    expect(next).toHaveTextContent("같은 날 오후")
    fireEvent.click(next)
    expect(openNext).toHaveBeenCalledOnce()
    expect(openPlan).not.toHaveBeenCalled()
  })

  it("keeps explicit pain above the primary task and rejects imported derived pain as before", () => {
    const pain = { ...EVENING, memoPurpose: undefined, note: "", date: todayISO(), painParts: { knee: 5 } }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...pain, fieldProvenance: {
      painParts: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "import.activity-file.v1" },
    } }]))
    const view = render(<Home />)
    expect(screen.queryByTestId("home-pain-review")).toBeNull()
    view.unmount()
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...pain, fieldProvenance: { painParts: { provenance: "EXPLICIT" } } }]))
    render(<Home />)
    const notice = screen.getByTestId("home-pain-review")
    expect(notice).toBeVisible()
    expect(notice.closest("details")).toBeNull()
    expect(notice.compareDocumentPosition(screen.getByRole("heading", { name: "내 기록" })) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it.each(["PENDING", "FAILED", "REJECTED", "CONFLICT"])("exposes %s storage state with a direct account action", status => {
    projection.status = status
    const onOpenAccount = vi.fn()
    render(<Home onOpenAccount={onOpenAccount} />)
    const action = screen.getByRole("button", { name: "계정 저장 상태 확인" })
    expect(action.closest("details")).toBeNull()
    fireEvent.click(action)
    expect(onOpenAccount).toHaveBeenCalledOnce()
  })

  it("offers a clear first record, plan, and honestly named example without empty data panels", () => {
    localStorage.clear()
    const onWriteLog = vi.fn(), onOpenPlan = vi.fn(), onOpenGuide = vi.fn()
    render(<Home onWriteLog={onWriteLog} onOpenPlan={onOpenPlan} onOpenGuide={onOpenGuide} />)
    fireEvent.click(screen.getByRole("button", { name: "오늘 기록 남기기" }))
    fireEvent.click(screen.getByRole("button", { name: "훈련 계획 만들기" }))
    fireEvent.click(screen.getByRole("button", { name: "일지 예시 보기" }))
    expect(onWriteLog).toHaveBeenCalledWith("quick-session")
    expect(onOpenPlan).toHaveBeenCalledOnce()
    expect(onOpenGuide).toHaveBeenCalledOnce()
    expect(screen.queryByRole("region", { name: "최근 하루 기록" })).toBeNull()
    expect(screen.queryByRole("region", { name: "기록 습관" })).toBeNull()
  })

  it("keeps the optional daily context inside today and usable", async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByText("기분·몸 상태·날씨 남기기"))
    await user.click(screen.getByRole("button", { name: "날씨 맑음" }))
    const context = screen.getByRole("region", { name: "오늘의 기분 몸 상태 날씨" })
    expect(screen.getByLabelText("오늘")).toContainElement(context)
    expect(screen.getByRole("button", { name: "날씨 맑음" })).toHaveAttribute("aria-pressed", "true")
    expect(context).toHaveTextContent("위치정보를 사용하지 않아요")
  })
})
