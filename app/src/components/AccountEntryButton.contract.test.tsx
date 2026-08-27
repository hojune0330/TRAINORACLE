// 로그인 발견성 계약(2026-08-27 홈 재검토):
//  1. 계정 기능이 켜진 빌드에서 비로그인 사용자는 홈 헤더에서
//     "로그인" 라벨이 붙은 계정 버튼을 바로 볼 수 있어야 한다.
//  2. 로그인된 사용자는 같은 자리에서 아이콘 버튼("내 계정")으로 계정 화면에 간다.
//  3. 계정 기능 OFF 빌드(키 미설정)는 아무것도 렌더링하지 않는다 —
//     로컬 전용 앱이라는 기존 약속을 지킨다.
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AccountEntryButton } from "./AccountEntryButton"

const enabledRef = { value: true }
const userRef = { value: null as null | { id: string; email: string | null; phone: string | null; provider: string | null } }

vi.mock("../domain/account/config", () => ({
  accountFeatureEnabled: () => enabledRef.value,
}))

vi.mock("../domain/account/auth", () => ({
  currentUser: () => Promise.resolve(userRef.value),
  onAuthChange: () => () => {},
}))

beforeEach(() => {
  enabledRef.value = true
  userRef.value = null
})
afterEach(cleanup)

describe("home account entry", () => {
  it("shows a visible 로그인 button for signed-out visitors", async () => {
    render(<AccountEntryButton onOpenAccount={vi.fn()} />)
    await act(async () => { await Promise.resolve() })

    const button = screen.getByRole("button", { name: "로그인 또는 가입" })
    expect(button).toBeVisible()
    expect(button).toHaveTextContent("로그인")
  })

  it("opens the account screen when pressed", async () => {
    const onOpenAccount = vi.fn()
    render(<AccountEntryButton onOpenAccount={onOpenAccount} />)
    await act(async () => { await Promise.resolve() })

    screen.getByRole("button", { name: "로그인 또는 가입" }).click()
    expect(onOpenAccount).toHaveBeenCalledTimes(1)
  })

  it("switches to a quiet 내 계정 icon once signed in", async () => {
    userRef.value = { id: "u1", email: "a@b.c", phone: null, provider: "google" }
    render(<AccountEntryButton onOpenAccount={vi.fn()} />)
    await act(async () => { await Promise.resolve() })

    const button = screen.getByRole("button", { name: "내 계정" })
    expect(button).toBeVisible()
    expect(button).not.toHaveTextContent("로그인")
  })

  it("renders nothing when the account feature is off", async () => {
    enabledRef.value = false
    const { container } = render(<AccountEntryButton onOpenAccount={vi.fn()} />)
    await act(async () => { await Promise.resolve() })

    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing without an open handler even when the feature is on", async () => {
    const { container } = render(<AccountEntryButton />)
    await act(async () => { await Promise.resolve() })

    expect(container).toBeEmptyDOMElement()
  })
})
