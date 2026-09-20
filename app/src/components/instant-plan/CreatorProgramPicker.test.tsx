import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { InstantPlanEntry } from "../../domain/instant-plan-contract"
import { creatorProgramFixture } from "../../domain/creator-program/creator-program.test-fixtures"
import { CreatorProgramPicker } from "./CreatorProgramPicker"

afterEach(cleanup)

const goal: InstantPlanEntry = { kind: "GOAL_ONLY", eventDistanceM: 5000, performanceSeconds: 1200 }
const chooseName = "테스트 전용 프로그램 내게 맞춰 보기"

describe("CreatorProgramPicker", () => {
  it("shows the empty supply state without inventing a program", () => {
    render(<CreatorProgramPicker onChoose={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent("가져올 수 있는 공개 프로그램이 없어요")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("allows discovery before intake and returns only the exact public source identity", () => {
    const onChoose = vi.fn()
    render(<CreatorProgramPicker programs={[creatorProgramFixture()]} onChoose={onChoose} />)
    expect(screen.getByText("테스트 제작자")).toBeVisible()
    expect(screen.getByText("계약 검사 전용 부담 표시")).toBeVisible()
    expect(screen.getByText("시작일부터 7일")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: chooseName }))
    expect(onChoose).toHaveBeenCalledExactlyOnceWith({ kind: "CREATOR", programId: "fixture-program", version: "1.0.0" })
  })

  it("chooses the correct original after invalid and unpublished sources were filtered out", () => {
    const hidden = creatorProgramFixture()
    hidden.title = "공개하면 안 되는 제목"
    hidden.grant!.publicListing = false
    const onChoose = vi.fn()
    render(<CreatorProgramPicker programs={[{ malformed: true }, hidden, creatorProgramFixture()]} entry={goal} onChoose={onChoose} />)
    expect(screen.queryByText(hidden.title)).not.toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: chooseName }))
    expect(onChoose).toHaveBeenCalledExactlyOnceWith({ kind: "CREATOR", programId: "fixture-program", version: "1.0.0" })
  })

  it.each(["WITHDRAWN", "RECALLED"] as const)("keeps a publicly listed %s source unavailable with its notice", status => {
    const program = creatorProgramFixture()
    program.lifecycle = { status, notice: "시험용 제공 중단 안내" }
    const onChoose = vi.fn()
    render(<CreatorProgramPicker programs={[program]} entry={goal} onChoose={onChoose} />)
    expect(screen.getByText(/시험용 제공 중단 안내/)).toBeVisible()
    const button = screen.getByRole("button", { name: chooseName })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onChoose).not.toHaveBeenCalled()
  })

  it("hides the title after its listing grant has been withdrawn", () => {
    const program = creatorProgramFixture()
    program.grant!.status = "WITHDRAWN"
    render(<CreatorProgramPicker programs={[program]} onChoose={vi.fn()} />)
    expect(screen.queryByText(program.title)).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("does not silently turn a goal into the current record required by a source", () => {
    const program = creatorProgramFixture()
    program.applicability = program.applicability.filter(item => item.kind === "CURRENT_RECORD")
    render(<CreatorProgramPicker programs={[program]} entry={goal} onChoose={vi.fn()} />)
    expect(screen.getByRole("button", { name: chooseName })).toBeDisabled()
    expect(screen.getByText("이 프로그램은 입력한 기록 조건으로 시작할 수 없어요.")).toBeVisible()
  })

  it("does not substitute another event when the source event differs", () => {
    render(<CreatorProgramPicker programs={[creatorProgramFixture()]} entry={{ ...goal, eventDistanceM: 10000 }} onChoose={vi.fn()} />)
    expect(screen.getByRole("button", { name: chooseName })).toBeDisabled()
    expect(screen.getByText("선택한 종목과 다른 프로그램이에요.")).toBeVisible()
  })

  it.each(["permission", "review"])("shows a reason for a public source blocked by %s", block => {
    const program = creatorProgramFixture()
    if (block === "permission") program.grant!.personalUse = false
    else program.review = null
    render(<CreatorProgramPicker programs={[program]} entry={goal} onChoose={vi.fn()} />)
    const button = screen.getByRole("button", { name: chooseName })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription(block === "permission"
      ? "개인 계획으로 가져오기가 허용되지 않았어요." : "적용 조건을 검토 중이라 아직 시작할 수 없어요.")
  })

  it.each(["grant", "version"])("rechecks a changed %s before selection and explains why it stopped", changed => {
    const program = creatorProgramFixture()
    const onChoose = vi.fn()
    render(<CreatorProgramPicker programs={[program]} entry={goal} onChoose={onChoose} />)
    if (changed === "grant") program.grant!.status = "WITHDRAWN"
    else {
      program.version = "2.0.0"
      program.grant!.version = "2.0.0"
      program.review!.version = "2.0.0"
    }
    fireEvent.click(screen.getByRole("button", { name: chooseName }))
    expect(onChoose).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("프로그램의 제공 조건이 변경됐어요")
  })

  it("respects an integrating screen's disabled state", () => {
    const onChoose = vi.fn()
    render(<CreatorProgramPicker programs={[creatorProgramFixture()]} disabled onChoose={onChoose} />)
    const button = screen.getByRole("button", { name: chooseName })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onChoose).not.toHaveBeenCalled()
  })
})
