import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TrainingLexicon } from "./TrainingLexicon"
import { GLOSSARY, TERM_CATEGORY_LABELS } from "../domain/glossary"
import { hasActiveBrowserBackLayer } from "../navigation/browserNavigation"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("TrainOracle training lexicon", () => {
  it("starts with frequent terms and categories, not the full dictionary or definitions", async () => {
    const user = userEvent.setup()
    render(<TrainingLexicon />)
    expect(screen.getByRole("heading", { name: "분류로 찾기" })).toBeVisible()
    expect(document.querySelectorAll(".training-lexicon__group")).toHaveLength(0)
    expect(screen.queryByText(GLOSSARY.rpe.short)).toBeNull()
    await user.click(screen.getByRole("button", { name: "전체 용어 보기" }))
    expect(document.querySelectorAll(".training-lexicon__group")).toHaveLength(8)
    expect(screen.queryByText(GLOSSARY.rpe.short)).toBeNull()
    expect(screen.getByRole("button", { name: /^운동 자각도\s*RPE$/u })).toBeVisible()
  })

  it("keeps search state but releases Back and focus while the mounted glossary is inactive", async () => {
    const user = userEvent.setup()
    let pendingReturn: FrameRequestCallback | undefined
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      pendingReturn = callback
      return 47
    })
    const view = render(<>
      <button type="button">Other help</button>
      <div hidden><TrainingLexicon active={false} /></div>
    </>)
    view.rerender(<>
      <button type="button">Other help</button>
      <div><TrainingLexicon active /></div>
    </>)

    await user.type(screen.getByRole("searchbox", { name: "용어 검색" }), "RPE")
    expect(hasActiveBrowserBackLayer()).toBe(true)
    const otherHelp = screen.getByRole("button", { name: "Other help" })
    otherHelp.focus()

    view.rerender(<>
      <button type="button">Other help</button>
      <div hidden><TrainingLexicon active={false} /></div>
    </>)

    expect(cancelFrame).toHaveBeenCalledWith(47)
    pendingReturn?.(0)
    await waitFor(() => expect(hasActiveBrowserBackLayer()).toBe(false))
    await waitFor(() => expect(otherHelp).toHaveFocus())

    view.rerender(<>
      <button type="button">Other help</button>
      <div><TrainingLexicon active /></div>
    </>)

    expect(screen.getByRole("searchbox", { name: "용어 검색" })).toHaveValue("RPE")
    await waitFor(() => expect(hasActiveBrowserBackLayer()).toBe(true))
  })

  it("preserves a selected category and restores the term opener and reading position", async () => {
    const user = userEvent.setup()
    render(<div className="app-scroll-region"><TrainingLexicon /></div>)
    await user.click(screen.getByRole("button", { name: TERM_CATEGORY_LABELS.INTENSITY_AND_RECORD }))
    await waitFor(() => expect(screen.getByRole("heading", { name: TERM_CATEGORY_LABELS.INTENSITY_AND_RECORD })).toHaveFocus())
    const region = document.querySelector<HTMLElement>(".app-scroll-region")!
    region.scrollTop = 210
    await user.click(screen.getByRole("button", { name: /^운동 자각도\s*RPE$/u }))
    await waitFor(() => expect(screen.getByRole("heading", { name: /운동 자각도.*RPE/u })).toHaveFocus())
    expect(region.scrollTop).toBe(0)
    await user.click(screen.getByRole("button", { name: "용어 목록" }))
    await waitFor(() => expect(screen.getByRole("button", { name: /^운동 자각도\s*RPE$/u })).toHaveFocus())
    expect(region.scrollTop).toBe(210)
    expect(screen.getByRole("heading", { name: TERM_CATEGORY_LABELS.INTENSITY_AND_RECORD })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "분류로 찾기" })).toBeNull()
  })

  it("returns native Back from a category to its chooser before leaving the glossary", async () => {
    const user = userEvent.setup()
    render(<div className="app-scroll-region"><TrainingLexicon /></div>)
    await user.click(screen.getByRole("button", { name: TERM_CATEGORY_LABELS.TRAINING_STRUCTURE }))
    expect(screen.getByRole("heading", { name: TERM_CATEGORY_LABELS.TRAINING_STRUCTURE })).toBeVisible()
    act(() => window.history.back())
    await waitFor(() => expect(screen.getByRole("heading", { name: "분류로 찾기" })).toBeVisible())
    await waitFor(() => expect(screen.getByRole("button", { name: TERM_CATEGORY_LABELS.TRAINING_STRUCTURE })).toHaveFocus())
  })
  it("returns native Back from an embedded term to its index without leaving the guide", async () => {
    const user = userEvent.setup()
    render(<TrainingLexicon />)
    await user.click(screen.getByRole("button", { name: /^운동 자각도\s*RPE$/u }))
    expect(screen.getByRole("heading", { name: /운동 자각도.*RPE/u })).toBeVisible()
    act(() => window.history.back())
    await waitFor(() => expect(screen.getByRole("searchbox", { name: "용어 검색" })).toBeVisible())
    expect(screen.getByRole("heading", { name: "훈련 용어집" })).toBeVisible()
  })
  it("searches a legacy Korean alias and opens its Korean-first term", async () => {
    const user = userEvent.setup()
    render(<TrainingLexicon />)

    await user.type(screen.getByRole("searchbox", { name: "용어 검색" }), "무산소 젖산")
    await user.click(screen.getByRole("button", { name: /짧은 고강도 반복.*GLY/u }))

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

  it("returns through related terms before leaving a direct-entry glossary", async () => {
    const user = userEvent.setup()
    let returned = 0
    render(<TrainingLexicon initialTerm="fat-metabolism" directEntry onBack={() => { returned += 1 }} />)

    await user.click(screen.getByRole("button", { name: "산화 대사" }))
    expect(screen.getByRole("heading", { name: "산화 대사" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "이전 용어" }))
    expect(screen.getByRole("heading", { name: "지방 대사" })).toBeVisible()
    expect(returned).toBe(0)

    await user.click(screen.getByRole("button", { name: "이전 화면" }))
    expect(returned).toBe(1)
  })

  it("delegates related terms to shell history for a direct in-app entry", async () => {
    const user = userEvent.setup()
    let nextTerm = ""
    render(
      <TrainingLexicon
        initialTerm="base"
        directEntry
        onBack={() => undefined}
        onNavigateTerm={(term) => { nextTerm = term }}
      />,
    )

    await user.click(screen.getByRole("button", { name: "산화 대사" }))
    expect(nextTerm).toBe("oxidative")
  })
})
