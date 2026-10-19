import { act, cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import type { PlanBetaState } from "../../domain/plan-beta-store"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { ActivePlan } from "./ActivePlan"

const callbacks = { onProgress: vi.fn(), onNextFrame: vi.fn(), onActivateNextFrame: vi.fn(), onCheckDetailedExecution: vi.fn() }
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")

function plan(startDate = "2026-08-27"): Extract<PlanBetaState, { version: 3 }> {
  const source = stateFixture()
  if (source.version !== 3) throw new Error("Expected the stored version 3 fixture")
  const sessions: PlanSession[] = [
    { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "LT_INTENT", prescription: {
      kind: "RPE_TIME_RANGE", rpe: { minimum: 6, maximum: 7 }, durationMinutes: { minimum: 30, maximum: 40 },
    } },
    { day: 1, slot: "PM", role: "EASY", plannedEnergyIntent: "RECOVERY_INTENT", prescription: {
      kind: "RPE_TIME_RANGE", rpe: { minimum: 1, maximum: 2 }, durationMinutes: { minimum: 15, maximum: 20 },
    } },
    { day: 2, slot: "AM", role: "REST", plannedEnergyIntent: "RECOVERY_INTENT", prescription: { kind: "REST" } },
  ]
  return { ...source, intake: { ...source.intake, startDate }, activePlan: { ...source.activePlan, sessions } }
}

beforeEach(async () => {
  window.localStorage.clear()
  await initializeCanonicalJournalFixture()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-08-27T03:00:00Z"))
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 767px)", addEventListener() {}, removeEventListener() {} }))
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", "") } })
})
afterEach(() => {
  cleanup()
  setActiveLocalAccount("reset-active-plan-view")
  setActiveLocalAccount(null)
  vi.unstubAllGlobals()
  vi.useRealTimers()
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal")
})

it("uses one selected-day session list, with a whole-card reader destination and a separate journal action", async () => {
  const state = plan(), original = JSON.stringify(state), write = vi.fn(), user = userEvent.setup()
  render(<ActivePlan state={state} {...callbacks} onWriteSessionLog={write} />)
  expect(screen.getByRole("radio", { name: "하루씩" })).toHaveAttribute("aria-checked", "true")
  expect(screen.queryByRole("button", { name: /오전 훈련 내용 보기 ·/u })).toBeNull()
  expect(screen.queryByRole("button", { name: /오후 훈련 내용 보기 ·/u })).toBeNull()
  expect(screen.queryByRole("heading", { name: "오늘 훈련" })).toBeNull()
  const morning = screen.getByRole("group", { name: "8월 27일 목요일 오전 세션" })
  const open = within(morning).getByRole("button", { name: "8월 27일 목요일 오전 훈련 내용 보기" })
  expect(open).toHaveClass("category-card")
  expect(open).toHaveTextContent("오전 · 주요")
  expect(open).toHaveTextContent("전체 30–40분 · 힘든 정도 6–7/10")
  expect(open).toHaveAccessibleDescription("주요 · 템포 훈련 · LT · 전체 30–40분 · 힘든 정도 6–7/10")
  expect(open.querySelector("button")).toBeNull()
  expect(within(morning).getByRole("note", { name: "훈련 구성 확인" })).toHaveTextContent("이 시간 내내 강하게 뛰지 마세요.")
  expect(within(morning).getByRole("note", { name: "훈련 구성 확인" }).closest("details")).toBeNull()
  const journal = within(morning).getByRole("button", { name: "이 훈련 일지 쓰기" })
  expect(open).not.toContainElement(journal)
  await user.click(within(open).getByRole("heading", { name: "템포 훈련 · LT" }))
  const reader = screen.getByRole("dialog", { name: "2026년 8월 27일 목요일" })
  expect(within(reader).getByRole("group", { name: "8월 27일 목요일 오전 세션" })).toHaveTextContent("전체 30–40분 · 힘든 정도 6–7/10")
  expect(within(reader).getByText("오전 · 주요")).toBeVisible()
  const codeHelp = within(reader).getByRole("button", { name: "주요 훈련 MAIN, 지속 페이스 LT 훈련 설명 보기" })
  expect(within(codeHelp).getByText("MAIN")).toBeVisible()
  expect(within(codeHelp).getByText("지속 페이스")).toBeVisible()
  expect(within(codeHelp).getByText("LT")).toBeVisible()
  expect(within(codeHelp).queryByText("주요 훈련")).toBeNull()
  await user.click(codeHelp)
  expect(screen.getByText(/준비 목표를 가장 직접적으로 다루는 훈련/u)).toBeVisible()
  expect(screen.getByText(/조금 힘든 느낌을 비교적 일정하게 유지/u)).toBeVisible()
  await user.click(codeHelp)
  expect(write).not.toHaveBeenCalled()
  await user.click(within(reader).getByRole("button", { name: "하루씩으로 돌아가기" }))
  expect(open).toHaveFocus()
  await user.click(screen.getByRole("button", { name: "8월 28일 금요일 선택" }))
  expect(screen.getByRole("group", { name: "8월 28일 금요일 오전 세션" })).toHaveTextContent("휴식")
  await user.click(screen.getByRole("button", { name: "오늘" }))
  expect(screen.getByRole("button", { name: "8월 27일 목요일 선택" })).toHaveAttribute("aria-pressed", "true")
  await user.click(journal)
  expect(write).toHaveBeenCalledExactlyOnceWith(state.activePlan.sessions[0])
  expect(JSON.stringify(state)).toBe(original)
})

it("keeps one plan context and groups the daily view with keyboard-operable date tools", async () => {
  const state = plan(), original = JSON.stringify(state), user = userEvent.setup()
  render(<ActivePlan state={state} {...callbacks} />)
  expect(screen.getByRole("heading", { level: 1, name: "9일 훈련 계획" })).toBeVisible()
  expect(screen.getAllByText("8월 27일(목) - 9월 4일(금)")).toHaveLength(1)
  const period = screen.getByText("8월 27일(목) - 9월 4일(금)")
  expect(period.closest("details")).toHaveClass("active-plan__information")
  expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleDescription(/계획 기간.*8월 27일/u)
  expect(screen.queryByText("9일 훈련 일정")).toBeNull()
  expect(screen.queryByText("08/27 ~ 09/04")).toBeNull()
  expect(screen.queryByRole("heading", { name: "날짜별 훈련" })).toBeNull()
  const tools = screen.getByRole("group", { name: "훈련 일정 보기와 날짜 이동" })
  expect(within(tools).getByRole("radio", { name: "하루씩" })).toHaveAttribute("aria-checked", "true")
  const next = within(tools).getByRole("button", { name: "다음 날짜" })
  next.focus()
  await user.keyboard("{Enter}")
  expect(next).toHaveFocus()
  expect(screen.getByRole("button", { name: "8월 28일 금요일 선택" })).toHaveAttribute("aria-pressed", "true")
  const list = screen.getByRole("list", { name: "날짜별 계획 미리보기" })
  list.focus()
  await user.keyboard("{ArrowLeft}")
  expect(list).toHaveFocus()
  expect(screen.getByRole("button", { name: "8월 27일 목요일 선택" })).toHaveAttribute("aria-pressed", "true")
  const guide = screen.getByText("훈련 구분·약어")
  expect(list.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  await user.click(guide)
  expect(screen.getByRole("button", { name: "주요 훈련 MAIN 일정표 구분 설명 보기" })).toBeVisible()
  await user.click(within(tools).getByRole("radio", { name: "달력" }))
  expect(screen.getByRole("grid", { name: "2026년 8월 달력" })).toBeVisible()
  expect(screen.getByRole("heading", { name: "오늘 훈련" })).toBeVisible()
  expect(JSON.stringify(state)).toBe(original)
})

it.each(["하루씩", "달력"] as const)("opens the exact pain progress record from %s without clearing it or changing the selected date", async view => {
  const source = plan()
  const state = { ...source, progress: [{ sessionDay: 1, sessionSlot: "PM" as const, state: "PAIN_CHECKIN" as const }] }
  const original = JSON.stringify(state), user = userEvent.setup()
  const onProgress = vi.fn(), onCheckDetailedExecution = vi.fn()
  render(<ActivePlan state={state} {...callbacks} onProgress={onProgress} onCheckDetailedExecution={onCheckDetailedExecution} />)
  await user.click(screen.getByRole("radio", { name: view }))
  if (view === "달력") await user.click(screen.getByRole("button", { name: "다음 달" }))
  else await user.click(screen.getByRole("button", { name: "8월 28일 금요일 선택" }))
  const selectedDate = () => document.querySelector('[data-date][data-selected="true"], [data-date][aria-pressed="true"]')?.getAttribute("data-date")
  const selectedBefore = selectedDate()
  const monthBefore = screen.queryByRole("grid")?.getAttribute("aria-label")
  const notice = screen.getByRole("region", { name: "훈련 안내" })
  expect(notice).toHaveAccessibleDescription("2026-08-27")
  expect(within(notice).getByRole("alert")).toHaveTextContent(/^통증 기록이 있어 훈련 안내를 멈췄어요$/)
  expect(within(notice).queryByRole("heading")).toBeNull()
  expect(screen.queryByText("2026-08-27")).toBeNull()
  const open = within(notice).getByRole("button", { name: "통증 기록 보기" })
  await user.click(open)
  const reader = screen.getByRole("dialog", { name: "2026년 8월 27일 목요일" })
  const records = within(reader).getByText("일지·진행 기록", { selector: '[data-session-slot="PM"] summary' }).closest("details")
  expect(records).toHaveAttribute("open")
  expect(within(reader).getByRole("button", { name: "오후" })).toHaveAttribute("aria-current", "location")
  await user.click(within(reader).getByRole("button", { name: view === "하루씩" ? "하루씩으로 돌아가기" : "달력으로 돌아가기" }))
  expect(open).toHaveFocus()
  expect(selectedDate()).toBe(selectedBefore)
  expect(screen.queryByRole("grid")?.getAttribute("aria-label")).toBe(monthBefore)
  expect(screen.getByRole("radio", { name: view })).toHaveAttribute("aria-checked", "true")
  expect(screen.getByRole("alert")).toHaveTextContent("통증 기록이 있어 훈련 안내를 멈췄어요")
  expect(onProgress).not.toHaveBeenCalled()
  expect(onCheckDetailedExecution).not.toHaveBeenCalled()
  expect(JSON.stringify(state)).toBe(original)
  if (view === "달력") {
    // A later direct calendar entry must no longer inherit notice-only navigation.
    await user.click(screen.getByRole("button", { name: /^2026년 9월 15일 화요일/u }))
    const outside = screen.getByRole("dialog", { name: "2026년 9월 15일 화요일" })
    await user.click(within(outside).getByRole("button", { name: "크게 보기 다음 날짜" }))
    const following = screen.getByRole("dialog", { name: "2026년 9월 16일 수요일" })
    await user.click(within(following).getByRole("button", { name: "달력으로 돌아가기" }))
    expect(selectedDate()).toBe("2026-09-16")
    expect(JSON.stringify(state)).toBe(original)
  }
})

it("keeps the chosen view across remount, separates a new plan, and resets on an account boundary", async () => {
  const state = plan(), user = userEvent.setup()
  const first = render(<ActivePlan state={state} {...callbacks} />)
  await user.click(screen.getByRole("radio", { name: "달력" }))
  expect(screen.getByRole("button", { name: "오전 훈련 내용 보기 · 템포 훈련 · LT" })).toBeVisible()
  first.unmount()
  const next = render(<ActivePlan state={state} {...callbacks} />)
  expect(screen.getByRole("radio", { name: "달력" })).toHaveAttribute("aria-checked", "true")
  const newPlan = { ...state, generatedAt: "2026-08-27T00:00:01.000Z" }
  next.rerender(<ActivePlan state={newPlan} {...callbacks} />)
  expect(screen.getByRole("radio", { name: "하루씩" })).toHaveAttribute("aria-checked", "true")
  next.rerender(<ActivePlan state={state} {...callbacks} />)
  expect(screen.getByRole("radio", { name: "달력" })).toHaveAttribute("aria-checked", "true")
  act(() => setActiveLocalAccount("another-owner"))
  expect(screen.getByRole("radio", { name: "하루씩" })).toHaveAttribute("aria-checked", "true")
})

it.each([
  ["2026-08-28", "아직 시작일 전이에요. 아래에서 첫 일정을 확인해요."],
  ["2026-08-01", "계획 기간이 끝났어요. 실제 수행 여부는 남긴 기록에서 확인해요."],
])("keeps the date context when today is outside the plan starting %s", (startDate, message) => {
  render(<ActivePlan state={plan(startDate)} {...callbacks} />)
  expect(screen.getByText(message)).toBeVisible()
  expect(screen.queryByRole("button", { name: "오늘" })).toBeNull()
})

it("keeps blocked and rest context beside the selected-day list", () => {
  const state = plan("2026-08-26")
  const view = render(<ActivePlan state={state} {...callbacks} />)
  expect(screen.getByText("오늘은 계획에 정해진 휴식일이에요.")).toBeVisible()
  view.rerender(<ActivePlan state={state} {...callbacks} executionBlocked />)
  expect(screen.getByRole("alert")).toHaveTextContent("훈련을 불러올 수 없어요.")
  expect(screen.getByRole("radio", { name: "하루씩" })).toHaveAttribute("aria-checked", "true")
})
