import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { setAccountAuthState } from "../domain/account/account-auth-state"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { createOracleReturnStore } from "../domain/oracle-return-state"
import { OracleReturnPanel } from "./OracleReturnPanel"

beforeEach(() => {
  window.localStorage.clear()
  setActiveLocalAccount(null)
  setAccountAuthState("GUEST")
})

afterEach(cleanup)

describe("OracleReturnPanel contract", () => {
  it("keeps compact resume short and does not expose participation controls", () => {
    const store = createOracleReturnStore({ storage: window.localStorage, scope: () => ({ kind: "guest" }) })
    store.enableOptIn()
    store.saveInterest("level")
    render(<OracleReturnPanel compact onOpenTopic={vi.fn()} />)
    expect(screen.getByTestId("oracle-return-panel")).toHaveTextContent("저장한 분석")
    expect(screen.queryByText("기록할 요일")).toBeNull()
    expect(screen.queryByRole("button", { name: /일지 저장|계획 확인|휴식 기록/ })).toBeNull()
  })

  it("shows at most two compact topics with the last selection first", () => {
    const store = createOracleReturnStore({ storage: window.localStorage, scope: () => ({ kind: "guest" }) })
    store.enableOptIn()
    store.saveInterest("level")
    store.saveInterest("focus")
    store.saveInterest("priority")
    store.selectTopic("priority")
    render(<OracleReturnPanel compact onOpenTopic={vi.fn()} />)
    const topicButtons = screen.getAllByRole("button")
    expect(topicButtons).toHaveLength(2)
    expect(topicButtons[0]).toHaveTextContent("우선 훈련")
    expect(topicButtons[1]).toHaveTextContent("현재 수준")
    expect(screen.queryByText("다음 훈련의 초점은 무엇으로 잡을까?")).toBeNull()
    expect(screen.queryByRole("button", { name: /관심 해제/ })).toBeNull()
  })

  it("saves an explicit interest and opens the selected topic", () => {
    const onOpenTopic = vi.fn()
    const store = createOracleReturnStore({ storage: window.localStorage, scope: () => ({ kind: "guest" }) })
    store.enableOptIn()
    store.saveInterest("level")
    render(<OracleReturnPanel onOpenTopic={onOpenTopic} />)
    expect(screen.getByTestId("oracle-return-panel")).toHaveTextContent("현재 수준")
    fireEvent.click(screen.getByRole("button", { name: /현재 수준지금 내 기록/ }))
    expect(onOpenTopic).toHaveBeenCalledWith("level")
  })

  it("shows unread only for a changed fingerprint", () => {
    const store = createOracleReturnStore({ storage: window.localStorage, scope: () => ({ kind: "guest" }) })
    store.enableOptIn()
    store.saveInterest("level")
    store.markTopicSeen("level", "a".repeat(64))
    const { rerender } = render(<OracleReturnPanel compact currentFingerprints={{ level: "a".repeat(64) }} onOpenTopic={vi.fn()} />)
    expect(screen.queryByText("업데이트")).toBeNull()
    rerender(<OracleReturnPanel compact currentFingerprints={{ level: "b".repeat(64) }} onOpenTopic={vi.fn()} />)
    expect(screen.getByText("업데이트")).toBeVisible()
  })

  it("never offers opening or sample viewing as participation actions", () => {
    render(<OracleReturnPanel onOpenTopic={vi.fn()} />)
    expect(screen.queryByRole("button", { name: /열기|샘플|예시/ })).toBeNull()
  })
})
