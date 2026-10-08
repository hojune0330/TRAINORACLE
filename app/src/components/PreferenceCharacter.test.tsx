import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { PreferenceCharacter } from "./PreferenceCharacter"

const motionKey = "trainoracle.calendar-reduced-motion.v1"

afterEach(() => {
  cleanup()
  localStorage.removeItem(motionKey)
  window.dispatchEvent(new StorageEvent("storage", { key: motionKey }))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it.each([
  ["STRUCTURE", "계획을 즐기는 러너", "계획을 챙기는 여우", "preference-structure-v1.webp", "미리 정한 순서와 일정을 좋아한다는 답을 담은 여우예요."],
  ["CHALLENGE", "기록 도전자", "기록을 살피는 수달", "preference-challenge-v1.webp", "내가 정한 기록 목표에 도전하는 과정이 즐겁다는 답을 담은 수달이에요."],
  ["INTENSITY", "강한 달리기 애호가", "달리는 느낌을 즐기는 토끼", "preference-intensity-v1.webp", "힘차게 달리는 느낌을 좋아한다는 답을 담은 토끼예요."],
  ["SOCIAL", "함께 달리는 러너", "함께 달리는 강아지", "preference-social-v1.webp", "다른 사람과 함께 달리는 시간이 좋다는 답을 담은 강아지예요."],
  ["EXPLORE", "새로움을 찾는 러너", "새 길이 궁금한 고양이", "preference-explore-v1.webp", "달리며 새로운 경험을 만나는 일이 좋다는 답을 담은 고양이예요."],
  ["REFRESH", "기분 전환 러너", "바람을 쐬는 곰", "preference-refresh-v1.webp", "기분을 전환하는 것이 달리는 이유라는 답을 담은 곰이에요."],
] as const)("shows the %s response character without duplicating the result heading", (axis, label, name, image, story) => {
  const { container } = render(<PreferenceCharacter axis={axis} label={label} />)
  expect(screen.getByRole("group", { name: `${label} 캐릭터` })).toBeVisible()
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  const illustration = container.querySelector("img")
  expect(illustration).toHaveAttribute("src", expect.stringContaining(image))
  expect(illustration).toHaveAttribute("alt", "")
  expect(illustration).toHaveAttribute("width", "80")
  expect(illustration).toHaveAttribute("height", "80")
  const button = screen.getByRole("button", { name: `${name} 캐릭터 이야기`, expanded: false })
  const explanation = screen.getByText(story)
  expect(explanation).not.toBeVisible()
  expect(button).toHaveAttribute("aria-controls", explanation.id)
  fireEvent.click(button)
  expect(explanation).toBeVisible()
  expect(button).toHaveAttribute("aria-expanded", "true")
})

it.each(["SU", "WE"] as const)("does not assign a character to optional axis %s", axis => {
  const { container } = render(<PreferenceCharacter axis={axis} label="보조 취향" />)
  expect(container).toBeEmptyDOMElement()
})

it("uses native keyboard activation and consumes Escape only while its story is open", async () => {
  const user = userEvent.setup()
  const parentKey = vi.fn()
  const writes = vi.spyOn(Storage.prototype, "setItem")
  render(<div onKeyDown={parentKey}><PreferenceCharacter axis="STRUCTURE" label="계획을 즐기는 러너" /></div>)
  const button = screen.getByRole("button", { name: "계획을 챙기는 여우 캐릭터 이야기" })
  await user.tab()
  expect(button).toHaveFocus()
  await user.keyboard("{Enter}")
  expect(button).toHaveAttribute("aria-expanded", "true")
  parentKey.mockClear()
  await user.keyboard("{Escape}")
  expect(button).toHaveAttribute("aria-expanded", "false")
  expect(button).toHaveFocus()
  expect(parentKey).not.toHaveBeenCalled()
  await user.keyboard("{Escape}")
  expect(parentKey).toHaveBeenCalledOnce()
  await user.keyboard(" ")
  expect(button).toHaveAttribute("aria-expanded", "true")
  expect(writes).not.toHaveBeenCalled()
})

it("keeps the character name and story usable after image failure and resets on another result", () => {
  const { container, rerender } = render(<PreferenceCharacter axis="STRUCTURE" label="계획을 즐기는 러너" />)
  fireEvent.error(container.querySelector("img")!)
  expect(container.querySelector("img")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "계획을 챙기는 여우 캐릭터 이야기" }))
  expect(screen.getByText("미리 정한 순서와 일정을 좋아한다는 답을 담은 여우예요.")).toBeVisible()
  rerender(<PreferenceCharacter axis="REFRESH" label="기분 전환 러너" />)
  expect(screen.getByRole("button", { name: "바람을 쐬는 곰 캐릭터 이야기", expanded: false })).toBeEnabled()
  expect(screen.queryByText("계획을 챙기는 여우")).not.toBeInTheDocument()
  expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("preference-refresh-v1.webp"))
})

it("honors live app motion settings while keeping the story usable", () => {
  render(<PreferenceCharacter axis="SOCIAL" label="함께 달리는 러너" />)
  const group = screen.getByRole("group", { name: "함께 달리는 러너 캐릭터" })
  expect(group).toHaveAttribute("data-reduced-motion", "false")
  act(() => {
    localStorage.setItem(motionKey, "true")
    window.dispatchEvent(new StorageEvent("storage", { key: motionKey }))
  })
  expect(group).toHaveAttribute("data-reduced-motion", "true")
  fireEvent.click(screen.getByRole("button", { name: "함께 달리는 강아지 캐릭터 이야기" }))
  expect(screen.getByText("다른 사람과 함께 달리는 시간이 좋다는 답을 담은 강아지예요.")).toBeVisible()
})

it("honors the operating system motion preference even when the app setting is off", () => {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)", media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })))
  render(<PreferenceCharacter axis="EXPLORE" label="새로움을 찾는 러너" />)
  expect(screen.getByRole("group", { name: "새로움을 찾는 러너 캐릭터" })).toHaveAttribute("data-reduced-motion", "true")
  fireEvent.click(screen.getByRole("button", { name: "새 길이 궁금한 고양이 캐릭터 이야기" }))
  expect(screen.getByText("달리며 새로운 경험을 만나는 일이 좋다는 답을 담은 고양이예요.")).toBeVisible()
})
