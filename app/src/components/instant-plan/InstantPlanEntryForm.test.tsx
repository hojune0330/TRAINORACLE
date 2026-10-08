import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { InstantPlanEntry } from "../../domain/instant-plan-contract"
import { InstantPlanEntryForm } from "./InstantPlanEntryForm"

afterEach(cleanup)

const TODAY = "2026-09-20"
it("uses the plan illustration only at a fresh, available entry and not after choosing an event", () => {
  const view = render(<InstantPlanEntryForm today={TODAY} onSubmit={vi.fn()} />)
  expect(view.container.querySelector('img[src$="plan-notebook-v2.webp"]')).toHaveAttribute("width", "64")
  chooseEvent()
  expect(view.container.querySelector("img")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "종목 다시 선택" }))
  expect(view.container.querySelector("img")).toBeNull()
})
it("omits the plan entry illustration while submission or disabled state needs attention", () => {
  const view = render(<InstantPlanEntryForm today={TODAY} onSubmit={vi.fn()} isSubmitting />)
  expect(view.container.querySelector("img")).toBeNull()
  view.rerender(<InstantPlanEntryForm today={TODAY} onSubmit={vi.fn()} disabled />)
  expect(view.container.querySelector("img")).toBeNull()
})
const record: InstantPlanEntry = {
  kind: "CURRENT_RECORD", eventDistanceM: 5000, performanceSeconds: 1500.125, achievedOn: "2026-09-01",
}

function chooseEvent(label = "5km") {
  fireEvent.click(screen.getByRole("button", { name: label }))
}

function chooseBasis(label: "내 기록" | "목표만 있어요" | "기록 없이" = "내 기록") {
  fireEvent.click(screen.getByRole("button", { name: label }))
}

function enterCurrent(eventLabel = "5km") {
  chooseEvent(eventLabel)
  chooseBasis("내 기록")
}

function submit(kind: "CURRENT_RECORD" | "GOAL_ONLY" = "CURRENT_RECORD") {
  fireEvent.click(screen.getByRole("button", { name: kind === "CURRENT_RECORD" ? "기록 입력 완료" : "목표 입력 완료" }))
}

function setTime(minutes: string, seconds: string) {
  fireEvent.change(screen.getByLabelText("분"), { target: { value: minutes } })
  fireEvent.change(screen.getByLabelText("초"), { target: { value: seconds } })
}

function openDate() {
  fireEvent.click(screen.getByText("기록 날짜 추가"))
}

describe("InstantPlanEntryForm", () => {
  it("shows ongoing preparation while the parent prevents repeated submission", () => {
    const onSubmit = vi.fn()
    const { rerender } = render(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
    rerender(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} disabled isSubmitting />)
    expect(screen.getByRole("button", { name: "계획 준비 중…" })).toBeDisabled()
    fireEvent.submit(screen.getByRole("form", { name: "계획 시작 정보" }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByLabelText("초")).toHaveValue("0.125")
    rerender(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
    expect(screen.getByRole("button", { name: "기록 입력 완료" })).toBeEnabled()
  })

  it("requires a real basis choice and distinguishes actual, goal and skipped time", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} onSubmit={onSubmit} />)
    expect(screen.getByText("계획 준비 · 종목 선택")).toBeVisible()
    expect(screen.getByText("하나를 고르면 다음 단계로 이동해요.")).toBeVisible()
    expect(screen.getByRole("group", { name: "어떤 종목을 준비하세요?" }))
      .toHaveAccessibleDescription("하나를 고르면 다음 단계로 이동해요.")
    chooseEvent("1500m")
    expect(screen.getByText("계획 준비 · 기록 선택")).toBeVisible()
    expect(screen.getByRole("group", { name: "1500m 기록이 있나요?" }))
      .toHaveAccessibleDescription("하나를 고르면 다음 단계로 이동해요.")
    expect(screen.getByRole("button", { name: "내 기록" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: "내 기록" })).toHaveAccessibleDescription("실제로 달린 시간")
    expect(screen.getByRole("button", { name: "목표만 있어요" })).toHaveAccessibleDescription("앞으로 달리고 싶은 시간")
    expect(screen.getByRole("button", { name: "기록 없이" })).toHaveAccessibleDescription("시간 입력 건너뛰기")
    expect(screen.queryByLabelText("분")).not.toBeInTheDocument()
    chooseBasis("내 기록")
    expect(screen.getByText("계획 준비 · 기록 입력")).toBeVisible()
    expect(screen.getByRole("heading", { name: "1500m를 달린 전체 시간" })).toHaveFocus()
    fireEvent.click(screen.getByRole("button", { name: "기준 다시 선택" }))
    expect(screen.getByRole("button", { name: "내 기록" })).toHaveAttribute("aria-pressed", "true")
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("returns directly from event correction with the time and date still waiting for explicit submission", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
    setTime("24", "10.25")
    fireEvent.click(screen.getByRole("button", { name: "5km 종목 다시 선택" }))
    expect(screen.getByRole("button", { name: "5km" })).toHaveAttribute("aria-pressed", "true")
    chooseEvent("3000m")
    expect(screen.getByRole("heading", { name: "3000m를 달린 전체 시간" })).toHaveFocus()
    expect(screen.getByLabelText("분")).toHaveValue("24")
    expect(screen.getByLabelText("초")).toHaveValue("10.25")
    expect(screen.getByText("2026-09-01")).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ ...record, eventDistanceM: 3000, performanceSeconds: 1450.25 })
  })

  it("can cancel event correction without changing the goal draft or reporting an edit", () => {
    const onSubmit = vi.fn()
    const onDraftChange = vi.fn()
    const goal: InstantPlanEntry = { kind: "GOAL_ONLY", eventDistanceM: 5000, performanceSeconds: 1200 }
    render(<InstantPlanEntryForm today={TODAY} initialEntry={goal} onSubmit={onSubmit} onDraftChange={onDraftChange} />)
    fireEvent.click(screen.getByRole("button", { name: "5km 종목 다시 선택" }))
    fireEvent.click(screen.getByRole("button", { name: "기록 입력으로" }))
    expect(screen.getByRole("heading", { name: "5km 목표 전체 시간" })).toHaveFocus()
    expect(screen.getByLabelText("분")).toHaveValue("20")
    expect(screen.queryByLabelText("기록 달성일")).not.toBeInTheDocument()
    expect(onDraftChange).not.toHaveBeenCalledWith(true)
    expect(onSubmit).not.toHaveBeenCalled()
    submit("GOAL_ONLY")
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(goal)
  })

  it("shows a retained date while collapsed and preserves date edits until explicit submission", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
    expect(screen.getByText("2026-09-01")).toBeVisible()
    expect(screen.getByLabelText("기록 달성일")).not.toBeVisible()
    await user.click(screen.getByText("기록 날짜"))
    expect(screen.getByLabelText("기록 달성일")).toBeVisible()
    fireEvent.change(screen.getByLabelText("기록 달성일"), { target: { value: "2026-09-02" } })
    await user.click(screen.getByText("기록 날짜"))
    expect(screen.getByLabelText("기록 달성일")).not.toBeVisible()
    expect(screen.getByText("2026-09-02")).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ ...record, achievedOn: "2026-09-02" })
  })

  it("requires explicit NO_RECORD selection again when editing a record-free entry", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={{ kind: "NO_RECORD", eventDistanceM: 1500 }} onSubmit={onSubmit} />)
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "종목 다시 선택" }))
    chooseEvent("800m")
    expect(onSubmit).not.toHaveBeenCalled()
    chooseBasis("기록 없이")
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ kind: "NO_RECORD", eventDistanceM: 800 })
  })

  it("supports the event and basis choices by keyboard before submitting the goal", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} onSubmit={onSubmit} />)
    screen.getByRole("button", { name: "800m" }).focus()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("heading", { name: "800m 기록이 있나요?" })).toHaveFocus()
    screen.getByRole("button", { name: "목표만 있어요" }).focus()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("heading", { name: "800m 목표 전체 시간" })).toHaveFocus()
    expect(onSubmit).not.toHaveBeenCalled()
    setTime("2", "30.5")
    screen.getByLabelText("초").focus()
    await user.keyboard("{Enter}")
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ kind: "GOAL_ONLY", eventDistanceM: 800, performanceSeconds: 150.5 })
  })

  it("reports changed values but not step navigation, and unmounting without submitting", () => {
    const onDraftChange = vi.fn()
    const onSubmit = vi.fn()
    const { unmount } = render(<InstantPlanEntryForm today={TODAY} initialEntry={record}
      onSubmit={onSubmit} onDraftChange={onDraftChange} />)
    expect(onDraftChange).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getByRole("button", { name: "기준 다시 선택" }))
    expect(onDraftChange).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getByRole("button", { name: "종목 다시 선택" }))
    expect(onDraftChange).toHaveBeenLastCalledWith(false)
    chooseEvent("5km")
    expect(onDraftChange).toHaveBeenLastCalledWith(false)
    chooseBasis("내 기록")
    setTime("21", "30.12")
    expect(onDraftChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(onDraftChange).toHaveBeenLastCalledWith(false)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("advances from event to basis to details and preserves values while going back", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
    expect(screen.getByRole("heading", { name: "5km를 달린 전체 시간" })).toBeVisible()
    setTime("24", "10.25")
    fireEvent.click(screen.getByRole("button", { name: "기준 다시 선택" }))
    expect(screen.getByRole("button", { name: "내 기록" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "종목 다시 선택" }))
    expect(screen.getByRole("button", { name: "5km" })).toHaveAttribute("aria-pressed", "true")
    chooseEvent("5km")
    chooseBasis("내 기록")
    expect(screen.getByLabelText("분")).toHaveValue("24")
    expect(screen.getByLabelText("초")).toHaveValue("10.25")
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ ...record, performanceSeconds: 1450.25 })
  })

  it("does not invent a starting event and focuses the event choice on a malformed form submit", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} onSubmit={onSubmit} />)
    fireEvent.submit(screen.getByRole("form", { name: "계획 시작 정보" }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "800m" })).toHaveFocus()
    expect(screen.getByRole("button", { name: "800m" })).toHaveAccessibleDescription("훈련할 종목을 선택해 주세요.")
    expect(screen.queryByLabelText("분")).not.toBeInTheDocument()
  })

  it("submits a real current record without losing fractional seconds", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} onSubmit={onSubmit} />)
    enterCurrent()
    setTime("25", "0.125")
    openDate()
    fireEvent.change(screen.getByLabelText("기록 달성일"), { target: { value: TODAY } })
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ ...record, achievedOn: TODAY })
  })

  it("prefills exact decimal values and opens directly at the current-record details", () => {
    const onSubmit = vi.fn()
    const initialEntry: InstantPlanEntry = { ...record, performanceSeconds: 90.12 }
    render(<InstantPlanEntryForm today={TODAY} initialEntry={initialEntry} onSubmit={onSubmit} sourceLabel="허용된 테스트 프로그램" />)
    expect(screen.getByRole("heading", { name: "5km를 달린 전체 시간" })).toBeVisible()
    expect(screen.getByLabelText("분")).toHaveValue("1")
    expect(screen.getByLabelText("초")).toHaveValue("30.12")
    expect(screen.getByText("선택한 프로그램: 허용된 테스트 프로그램")).toBeVisible()
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(initialEntry)
  })

  it("keeps a finite fractional prefill in decimal input notation", () => {
    const onSubmit = vi.fn()
    const initialEntry: InstantPlanEntry = { ...record, performanceSeconds: 0.0000001 }
    render(<InstantPlanEntryForm today={TODAY} initialEntry={initialEntry} onSubmit={onSubmit} />)
    expect(screen.getByLabelText("초")).toHaveValue("0.0000001")
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(initialEntry)
  })

  it("keeps goal and current drafts separate and does not carry a current date into a goal", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
    expect(screen.getByText("입력한 현재 기록은 내 기록에도 남아요.")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "기준 다시 선택" }))
    chooseBasis("목표만 있어요")
    expect(screen.getByLabelText("분")).toHaveValue("")
    expect(screen.queryByText("입력한 현재 기록은 내 기록에도 남아요.")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("기록 달성일")).not.toBeInTheDocument()
    setTime("22", "30.5")
    fireEvent.click(screen.getByRole("button", { name: "기준 다시 선택" }))
    chooseBasis("내 기록")
    expect(screen.getByLabelText("분")).toHaveValue("25")
    expect(screen.getByLabelText("초")).toHaveValue("0.125")
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(record)
    fireEvent.click(screen.getByRole("button", { name: "기준 다시 선택" }))
    chooseBasis("목표만 있어요")
    expect(screen.getByLabelText("분")).toHaveValue("22")
    expect(screen.getByLabelText("초")).toHaveValue("30.5")
    submit("GOAL_ONLY")
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onSubmit).toHaveBeenLastCalledWith({ kind: "GOAL_ONLY", eventDistanceM: 5000, performanceSeconds: 1350.5 })
  })

  it("starts an initial goal at its detail step and does not convert it to a current performance", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY}
      initialEntry={{ kind: "GOAL_ONLY", eventDistanceM: 5000, performanceSeconds: 1200 }} onSubmit={onSubmit} />)
    expect(screen.getByRole("heading", { name: "5km 목표 전체 시간" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "기준 다시 선택" }))
    chooseBasis("내 기록")
    expect(screen.getByLabelText("분")).toHaveValue("")
    openDate()
    expect(screen.getByLabelText("기록 달성일")).toHaveValue("")
    submit()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("submits NO_RECORD immediately when chosen without a redundant submit button", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole("button", { name: "기준 다시 선택" }))
    expect(screen.queryByLabelText("분")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("초")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("기록 달성일")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "기록 입력 완료" })).not.toBeInTheDocument()
    chooseBasis("기록 없이")
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ kind: "NO_RECORD", eventDistanceM: 5000 })
  })

  it.each([
    [800, "800m"], [1500, "1500m"], [3000, "3000m"], [5000, "5km"],
    [10000, "10km"], [21097, "하프 마라톤"], [42195, "마라톤"],
  ] as const)("accepts the existing %i m event without claiming prescription eligibility", (eventDistanceM, label) => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} onSubmit={onSubmit} />)
    chooseEvent(label)
    chooseBasis("기록 없이")
    const entry: InstantPlanEntry = { kind: "NO_RECORD", eventDistanceM }
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(entry)
  })

  it.each([
    ["-1", "0", "분"], ["1.5", "0", "분"], ["NaN", "0", "분"],
    ["Infinity", "0", "분"], ["1e2", "0", "분"], ["9".repeat(309), "0", "분"],
    ["9".repeat(308), "0", "분"],
    ["1", "60", "초"], ["1", "-0.1", "초"], ["1", "NaN", "초"],
    ["1", "Infinity", "초"], ["1", "30,5", "초"], ["1", "1e1", "초"],
    ["0", "0", "분"], ["", "", "분"],
  ])("rejects invalid time %s min / %s sec and focuses %s", (minutes, seconds, field) => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
    setTime(minutes, seconds)
    submit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByLabelText(field)).toHaveFocus()
    expect(screen.getByLabelText(field)).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("alert")).toBeVisible()
    expect(screen.getByLabelText("분")).toHaveValue(minutes)
    expect(screen.getByLabelText("초")).toHaveValue(seconds)
  })

  it.each([["25", "", 1500], ["", ".5", 0.5], ["0", "59.999", 59.999]] as const)(
    "accepts %s min / %s sec with only a blank component treated as zero", (minutes, seconds, expected) => {
      const onSubmit = vi.fn()
      render(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
      setTime(minutes, seconds)
      submit()
      expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ ...record, performanceSeconds: expected })
    },
  )

  it("keeps an unknown date optional and hidden without inventing today", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={{ ...record, achievedOn: null }} onSubmit={onSubmit} />)
    expect(screen.getByLabelText("기록 달성일")).not.toBeVisible()
    expect(screen.getByText("기록 날짜 추가")).toBeVisible()
    expect(screen.getByText("선택")).toBeVisible()
    expect(screen.getByText("개인 페이스를 계산하려면 기록 날짜가 필요해요. 모르면 비워 두세요. 시간·힘든 정도 기준 계획으로 시작할 수 있어요.")).toBeVisible()
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ ...record, achievedOn: null })
  })

  it.each(["2026-09-21", "2023-02-29", "2026-04-31", "0000-01-01", "2026-13-01"])(
    "opens the optional date and rejects the invalid or future record date %s", achievedOn => {
      const onSubmit = vi.fn()
      render(<InstantPlanEntryForm today={TODAY} initialEntry={{ ...record, achievedOn }} onSubmit={onSubmit} />)
      submit()
      expect(onSubmit).not.toHaveBeenCalled()
      expect(screen.getByLabelText("기록 달성일")).toBeVisible()
      expect(screen.getByLabelText("기록 달성일")).toHaveFocus()
      expect(screen.getByLabelText("기록 달성일")).toHaveAttribute("aria-invalid", "true")
      expect(screen.getByText("날짜 확인 필요")).toBeVisible()
    },
  )

  it("accepts an actual leap day without changing its calendar date", () => {
    const onSubmit = vi.fn()
    const entry = { ...record, achievedOn: "2024-02-29" }
    render(<InstantPlanEntryForm today={TODAY} initialEntry={entry} onSubmit={onSubmit} />)
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(entry)
  })

  it("re-reads the supplied live day at submit without a rerender and keeps genuinely future dates blocked", () => {
    const onSubmit = vi.fn(), entry = { ...record, achievedOn: "2026-09-21" }
    let day = TODAY
    render(<InstantPlanEntryForm today={TODAY} readToday={() => day} initialEntry={entry} onSubmit={onSubmit} />)
    day = "2026-09-21"
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(entry)
    onSubmit.mockClear()
    fireEvent.change(screen.getByLabelText("기록 달성일"), { target: { value: "2026-09-22" } })
    submit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("달성일은 오늘 또는 이전 날짜")
  })

  it("refreshes the date picker limit on focus after midnight while preserving entered values", () => {
    let day = TODAY
    render(<InstantPlanEntryForm today={TODAY} readToday={() => day} initialEntry={record} onSubmit={vi.fn()} />)
    const date = screen.getByLabelText("기록 달성일")
    expect(date).toHaveAttribute("max", TODAY)
    day = "2026-09-21"
    fireEvent.focus(date)
    expect(date).toHaveAttribute("max", day)
    expect(date).toHaveValue(record.achievedOn)
    expect(screen.getByLabelText("분")).toHaveValue("25")
    expect(screen.getByLabelText("초")).toHaveValue("0.125")
  })

  it("fails closed for current records when the supplied local today is invalid", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today="2026-02-30" initialEntry={record} onSubmit={onSubmit} />)
    submit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByLabelText("기록 달성일")).toHaveFocus()
    expect(screen.getByRole("alert")).toHaveTextContent("오늘 날짜를 확인하지 못했어요")
  })

  it("clears record errors when NO_RECORD is explicitly selected", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY}
      initialEntry={{ ...record, achievedOn: "2026-09-21" }} onSubmit={onSubmit} />)
    submit()
    expect(screen.getByRole("alert")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "기준 다시 선택" }))
    chooseBasis("기록 없이")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ kind: "NO_RECORD", eventDistanceM: 5000 })
  })

  it("prevents callback submission while disabled even if a form submit is dispatched", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={record} disabled onSubmit={onSubmit} />)
    expect(screen.getByLabelText("분")).toBeDisabled()
    expect(screen.getByLabelText("기록 달성일")).toBeDisabled()
    expect(screen.getByRole("button", { name: "기록 입력 완료" })).toBeDisabled()
    fireEvent.submit(screen.getByRole("form", { name: "계획 시작 정보" }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("supports keyboard submission, persistent labels and the appropriate numeric keyboards", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
    expect(screen.getByLabelText("분")).toHaveAttribute("inputmode", "numeric")
    expect(screen.getByLabelText("초")).toHaveAttribute("inputmode", "decimal")
    screen.getByLabelText("초").focus()
    await user.keyboard("{Enter}")
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(record)
  })
})
