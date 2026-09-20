import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { InstantPlanEntry } from "../../domain/instant-plan-contract"
import { InstantPlanEntryForm } from "./InstantPlanEntryForm"

afterEach(cleanup)

const TODAY = "2026-09-20"
const record: InstantPlanEntry = {
  kind: "CURRENT_RECORD", eventDistanceM: 5000, performanceSeconds: 1500.125, achievedOn: "2026-09-01",
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "내 계획 받기" }))
}

function setTime(minutes: string, seconds: string) {
  fireEvent.change(screen.getByLabelText("분"), { target: { value: minutes } })
  fireEvent.change(screen.getByLabelText("초"), { target: { value: seconds } })
}

describe("InstantPlanEntryForm", () => {
  it("does not invent a starting event, performance or achieved date and focuses the missing event", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} onSubmit={onSubmit} />)
    expect(screen.getByLabelText("종목")).toHaveValue("")
    expect(screen.getByLabelText("분")).toHaveValue("")
    expect(screen.getByLabelText("초")).toHaveValue("")
    expect(screen.getByLabelText("기록 달성일")).toHaveValue("")
    submit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByLabelText("종목")).toHaveFocus()
    expect(screen.getByLabelText("종목")).toHaveAccessibleDescription("훈련할 종목을 선택해 주세요.")
  })

  it("submits a real current record without losing fractional seconds", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText("종목"), { target: { value: "5000" } })
    setTime("25", "0.125")
    fireEvent.change(screen.getByLabelText("기록 달성일"), { target: { value: TODAY } })
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ ...record, achievedOn: TODAY })
  })

  it("prefills the exact decimal display and permits immediate submission", () => {
    const onSubmit = vi.fn()
    const initialEntry: InstantPlanEntry = { ...record, performanceSeconds: 90.12 }
    render(<InstantPlanEntryForm today={TODAY} initialEntry={initialEntry} onSubmit={onSubmit} sourceLabel="허용된 테스트 프로그램" />)
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

  it("does not turn a goal into a current record or carry over the achieved date", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole("radio", { name: "목표만 있어요" }))
    setTime("22", "30.5")
    expect(screen.queryByLabelText("기록 달성일")).not.toBeInTheDocument()
    expect(screen.getByText("목표는 현재 실력과 구분해서 사용해요.")).toBeVisible()
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ kind: "GOAL_ONLY", eventDistanceM: 5000, performanceSeconds: 1350.5 })
  })

  it("supports NO_RECORD with only the event and no hidden inferred time", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole("radio", { name: "기록 없이" }))
    expect(screen.queryByLabelText("분")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("초")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("기록 달성일")).not.toBeInTheDocument()
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ kind: "NO_RECORD", eventDistanceM: 5000 })
  })

  it("keeps current and goal drafts separate when switching input modes", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={record} onSubmit={onSubmit} />)
    expect(screen.getByText("입력한 현재 기록은 내 기록에도 남아요.")).toBeVisible()
    fireEvent.click(screen.getByRole("radio", { name: "목표만 있어요" }))
    expect(screen.getByLabelText("분")).toHaveValue("")
    expect(screen.queryByText("입력한 현재 기록은 내 기록에도 남아요.")).not.toBeInTheDocument()
    setTime("22", "30")
    fireEvent.click(screen.getByRole("radio", { name: "내 기록" }))
    expect(screen.getByLabelText("분")).toHaveValue("25")
    expect(screen.getByLabelText("초")).toHaveValue("0.125")
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(record)
    fireEvent.click(screen.getByRole("radio", { name: "목표만 있어요" }))
    expect(screen.getByLabelText("분")).toHaveValue("22")
    expect(screen.getByLabelText("초")).toHaveValue("30")
  })

  it("does not convert an initial goal into a current performance when the mode changes", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={{ kind: "GOAL_ONLY", eventDistanceM: 5000, performanceSeconds: 1200 }} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole("radio", { name: "내 기록" }))
    expect(screen.getByLabelText("분")).toHaveValue("")
    expect(screen.getByLabelText("기록 달성일")).toHaveValue("")
    submit()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it.each([800, 1500, 3000, 5000, 10000, 21097, 42195] as const)("accepts the existing %i m input without claiming prescription eligibility", eventDistanceM => {
    const onSubmit = vi.fn()
    const entry: InstantPlanEntry = { kind: "NO_RECORD", eventDistanceM }
    render(<InstantPlanEntryForm today={TODAY} initialEntry={entry} onSubmit={onSubmit} />)
    submit()
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

  it.each(["", "2026-09-21", "2023-02-29", "2026-04-31", "0000-01-01", "2026-13-01"])(
    "rejects the invalid or future record date %s even in a prefilled entry", achievedOn => {
      const onSubmit = vi.fn()
      render(<InstantPlanEntryForm today={TODAY} initialEntry={{ ...record, achievedOn }} onSubmit={onSubmit} />)
      submit()
      expect(onSubmit).not.toHaveBeenCalled()
      expect(screen.getByLabelText("기록 달성일")).toHaveFocus()
      expect(screen.getByLabelText("기록 달성일")).toHaveAttribute("aria-invalid", "true")
    },
  )

  it("accepts an actual leap day without changing its calendar date", () => {
    const onSubmit = vi.fn()
    const entry = { ...record, achievedOn: "2024-02-29" }
    render(<InstantPlanEntryForm today={TODAY} initialEntry={entry} onSubmit={onSubmit} />)
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(entry)
  })

  it("fails closed for current records when the supplied local today is invalid", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today="2026-02-30" initialEntry={record} onSubmit={onSubmit} />)
    submit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("오늘 날짜를 확인하지 못했어요")
  })

  it("clears obsolete record errors when explicitly switching to NO_RECORD", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={{ ...record, achievedOn: "" }} onSubmit={onSubmit} />)
    submit()
    expect(screen.getByRole("alert")).toBeVisible()
    fireEvent.click(screen.getByRole("radio", { name: "기록 없이" }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    submit()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ kind: "NO_RECORD", eventDistanceM: 5000 })
  })

  it("prevents callback submission while disabled even if a form submit is dispatched", () => {
    const onSubmit = vi.fn()
    render(<InstantPlanEntryForm today={TODAY} initialEntry={record} disabled onSubmit={onSubmit} />)
    expect(screen.getByLabelText("종목")).toBeDisabled()
    expect(screen.getByRole("button", { name: "내 계획 받기" })).toBeDisabled()
    fireEvent.submit(screen.getByRole("form", { name: "내 계획 받기" }))
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
