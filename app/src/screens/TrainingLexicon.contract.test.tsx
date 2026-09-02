import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { TrainingLexicon } from "./TrainingLexicon"

afterEach(cleanup)

describe("TrainOracle training lexicon", () => {
  it("searches a legacy Korean alias and opens its Korean-first term", async () => {
    const user = userEvent.setup()
    render(<TrainingLexicon />)

    await user.type(screen.getByRole("searchbox", { name: "용어 검색" }), "무산소 젖산")
    await user.click(screen.getByRole("button", { name: /짧은 고강도 반복.*해당과정/u }))

    expect(screen.getByRole("heading", { name: /짧은 고강도 반복.*GLY/u })).toBeVisible()
    expect(screen.getByText(/포도당을 분해해 ATP를 만드는 해당과정/u)).toBeVisible()
  })

  it("keeps the easy layer concise and reveals scientific context on request", async () => {
    const user = userEvent.setup()
    render(<TrainingLexicon initialTerm="gly" />)

    expect(screen.getByText(/짧고 강한 구간과 목적에 맞는 회복을 함께/u)).toBeVisible()
    expect(screen.queryByText(/짧고 강한 구간을 충분한 회복과 함께/u)).toBeNull()
    expect(screen.queryByText(/해당과정의 기여가 커질 수 있지만/u)).toBeNull()

    await user.click(screen.getByRole("button", { name: "전문 설명" }))
    expect(screen.getByText(/해당과정의 기여가 커질 수 있지만/u)).toBeVisible()
    expect(screen.getByText(/젖산은 단순한 노폐물이 아니며/u)).toBeVisible()
    expect(screen.getByRole("link", { name: "젖산 셔틀과 유산소 대사" })).toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/32444344/")
  })

  it("keeps related-term navigation inside the same glossary", async () => {
    const user = userEvent.setup()
    render(<TrainingLexicon initialTerm="fat-metabolism" />)

    await user.click(screen.getByRole("button", { name: "산화 대사" }))
    expect(screen.getByRole("heading", { name: "산화 대사" })).toBeVisible()
    expect(screen.getByText(/지방만 태우는 별도 시스템은 아니에요/u)).toBeVisible()
  })
})
