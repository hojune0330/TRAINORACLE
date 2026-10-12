import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { scoreOracleResponses, type OracleAxisScore } from "../domain/oracle-profile-v2"
import { PreferenceRadar } from "./PreferenceRadar"

afterEach(cleanup)

const primaryIds = ["STRUCTURE", "CHALLENGE", "INTENSITY", "SOCIAL", "EXPLORE", "REFRESH"] as const
const labels = ["계획", "기록 도전", "강한 달리기", "함께 달리기", "새로운 경험", "기분 전환"]
function allComplete() {
  return scoreOracleResponses(Object.fromEntries([...primaryIds, "SU", "WE"].flatMap((id, index) => (
    [1, 2, 3].map(question => [`${id}_${question}`, index % 5 + 1])
  ))))
}

describe("preference radar", () => {
  it("draws a real zero at the center but leaves missing and nonnumeric answers unplotted", () => {
    const scores = scoreOracleResponses({ STRUCTURE_1: 1, STRUCTURE_2: 1, STRUCTURE_3: 1,
      CHALLENGE_1: 5, CHALLENGE_2: "UNKNOWN", CHALLENGE_3: "SKIPPED" })
    const { container } = render(<PreferenceRadar scores={scores} onSelectAxis={vi.fn()} />)
    const points = container.querySelectorAll(".preference-radar__point")
    expect(points).toHaveLength(1)
    expect(points[0]).toHaveAttribute("data-axis", "STRUCTURE")
    expect(points[0]).toHaveAttribute("cx", "180")
    expect(points[0]).toHaveAttribute("cy", "144")
    expect(container.querySelector(".preference-radar__shape")).toBeNull()
    expect(screen.getByRole("button", { name: "계획, 0점, 결과 보기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "기록 도전, 응답 보기" })).toBeVisible()
    expect(screen.getByRole("img")).toHaveAccessibleName(expect.stringContaining("계획: 0점. 기록 도전: 응답 보기, 점수 없음"))
  })

  it("connects exactly six complete primary scores clockwise in the requested order", () => {
    const { container } = render(<PreferenceRadar scores={allComplete().reverse()} onSelectAxis={vi.fn()} />)
    expect(screen.getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual([
      "계획, 0점, 결과 보기", "기록 도전, 25점, 결과 보기", "강한 달리기, 50점, 결과 보기",
      "함께 달리기, 75점, 결과 보기", "새로운 경험, 100점, 결과 보기", "기분 전환, 0점, 결과 보기",
    ])
    expect([...container.querySelectorAll(".preference-radar__point")].map(point => point.getAttribute("data-axis"))).toEqual(primaryIds)
    const coordinates = container.querySelector(".preference-radar__shape")!.getAttribute("points")!
      .split(" ").map(point => point.split(",").map(Number))
    expect(coordinates).toHaveLength(6)
    const expected = [[180, 144], [198.6195, 133.25], [217.2391, 165.5], [180, 208.5], [105.5218, 187], [180, 144]]
    coordinates.forEach((point, index) => point.forEach((value, dimension) => expect(value).toBeCloseTo(expected[index]![dimension]!, 3)))
    expect(container.querySelectorAll(".preference-radar__guide")).toHaveLength(2)
    expect([...container.querySelectorAll(".preference-radar__axis-label")].map(label => label.textContent)).toEqual([
      "계획", "기록 도전", "강한 달리기", "함께", "새 경험", "기분 전환",
    ])
    expect(screen.getByRole("img")).not.toHaveAccessibleName(expect.stringMatching(/보조 운동|웨이트/u))
  })

  it("keeps independent completed points when one primary score is still partial", () => {
    const scores = allComplete().map(score => score.axisId === "EXPLORE" ? { ...score, state: "PARTIAL" as const, display: 100 } : score)
    const { container } = render(<PreferenceRadar scores={scores} onSelectAxis={vi.fn()} />)
    expect(container.querySelectorAll(".preference-radar__point")).toHaveLength(5)
    expect(container.querySelector('.preference-radar__point[data-axis="EXPLORE"]')).toBeNull()
    expect(container.querySelector(".preference-radar__shape")).toBeNull()
    expect(screen.getByText("답이 더 필요한 항목 1개")).toBeVisible()
    expect(screen.getByRole("button", { name: "새로운 경험, 응답 보기" })).toBeVisible()
  })

  it.each([NaN, Infinity, -5, 105, null])("does not plot an invalid numeric display of %s", value => {
    const scores = allComplete().map(score => score.axisId === "STRUCTURE" ? { ...score, display: value } : score)
    const { container } = render(<PreferenceRadar scores={scores} onSelectAxis={vi.fn()} />)
    expect(container.querySelector('.preference-radar__point[data-axis="STRUCTURE"]')).toBeNull()
    expect(container.querySelector(".preference-radar__shape")).toBeNull()
    expect(screen.getByRole("button", { name: "계획, 답 더하기" })).toBeVisible()
  })

  it("shows nothing when there is no primary numeric score, including optional-only completion", () => {
    const { container, rerender } = render(<PreferenceRadar scores={scoreOracleResponses({})} onSelectAxis={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<PreferenceRadar scores={scoreOracleResponses({ STRUCTURE_1: "SKIPPED", SU_1: 5, SU_2: 5, SU_3: 5 })} onSelectAxis={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("keeps mixed responses visible beside complete scores and partial answers and in the table", async () => {
    const user = userEvent.setup()
    const scores = scoreOracleResponses({ STRUCTURE_1: 1, STRUCTURE_2: 3, STRUCTURE_3: 5,
      CHALLENGE_1: 1, CHALLENGE_2: 5, CHALLENGE_3: "VARIES" })
    const { container } = render(<PreferenceRadar scores={scores} onSelectAxis={vi.fn()} />)
    expect(container.querySelectorAll(".preference-radar__point")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "계획, 50점, 결과 보기, 답이 엇갈림" })).toHaveTextContent("50점 · 답이 엇갈림")
    expect(screen.getByRole("button", { name: "기록 도전, 응답 보기, 답이 엇갈림" })).toHaveTextContent("응답 보기 · 답이 엇갈림")
    expect(screen.getByRole("img")).toHaveAccessibleName(expect.stringContaining("계획: 50점, 답이 엇갈림. 기록 도전: 응답 보기, 점수 없음, 답이 엇갈림"))
    await user.click(screen.getByText("점수 표로 보기"))
    const table = screen.getByRole("table")
    expect(within(table).getByRole("rowheader", { name: "계획" }).closest("tr")).toHaveTextContent("50점 · 답이 엇갈림")
    expect(within(table).getByRole("rowheader", { name: "기록 도전" }).closest("tr")).toHaveTextContent("— · 응답 보기 · 답이 엇갈림")
  })

  it("provides every plotted and missing value in the image summary and an exact accessible table", async () => {
    const user = userEvent.setup()
    const scores = allComplete().filter(score => score.axisId !== "SOCIAL")
    render(<PreferenceRadar scores={scores} onSelectAxis={vi.fn()} />)
    const image = screen.getByRole("img")
    expect(image).toHaveAccessibleName("러닝 취향, 내 응답 기준 0에서 100점. 계획: 0점. 기록 도전: 25점. 강한 달리기: 50점. 함께 달리기: 답 더하기, 점수 없음. 새로운 경험: 100점. 기분 전환: 0점.")
    expect(screen.getByRole("table")).not.toBeVisible()
    await user.click(screen.getByText("점수 표로 보기"))
    const table = screen.getByRole("table", { name: "러닝 취향 점수 · 내 응답 기준 0–100점" })
    expect(within(table).getAllByRole("rowheader").map(cell => cell.textContent)).toEqual(labels)
    expect(within(table).getAllByRole("cell").map(cell => cell.textContent)).toEqual(["0점", "25점", "50점", "— · 답 더하기", "100점", "0점"])
    within(table).getAllByRole("rowheader").forEach(cell => expect(cell).toHaveAttribute("scope", "row"))
  })

  it("selects the requested answered or missing axis by keyboard and respects disabled controls", async () => {
    const user = userEvent.setup()
    const onSelectAxis = vi.fn()
    const scores: OracleAxisScore[] = scoreOracleResponses({ STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 })
    const { rerender } = render(<PreferenceRadar scores={scores} onSelectAxis={onSelectAxis} />)
    await user.tab()
    expect(screen.getByRole("button", { name: "계획, 100점, 결과 보기" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(onSelectAxis).toHaveBeenLastCalledWith("STRUCTURE")
    await user.tab()
    await user.keyboard(" ")
    expect(onSelectAxis).toHaveBeenLastCalledWith("CHALLENGE")
    expect(onSelectAxis).toHaveBeenCalledTimes(2)
    rerender(<PreferenceRadar scores={scores} onSelectAxis={onSelectAxis} disabled />)
    screen.getAllByRole("button").forEach(button => {
      expect(button).toBeDisabled()
      fireEvent.click(button)
    })
    expect(onSelectAxis).toHaveBeenCalledTimes(2)
  })
})
