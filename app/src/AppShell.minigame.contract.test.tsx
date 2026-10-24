import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"

vi.mock("./components/AppShellFrame", () => ({ AppShellFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock("./screens/Home", () => ({ Home: ({ onOpenMore, onOpenMinigame }: { onOpenMore: () => void; onOpenMinigame: () => void }) => <><h1>홈</h1><button onClick={onOpenMore}>더보기</button><button onClick={onOpenMinigame}>게임하기</button></> }))
vi.mock("./DeferredMobileScreens", () => ({ DeferredMobileScreens: {
  More: ({ onOpenMinigame }: { onOpenMinigame: () => void }) => <main><h1>더보기</h1><button onClick={onOpenMinigame}>미니게임</button></main>,
  TreadmillGame: ({ onBack, backLabel }: { onBack: () => void; backLabel: string }) => <main><h1>멈추면 밀려나는 트랙</h1><button onClick={onBack}>{backLabel}</button></main>,
} }))

import { AppShell } from "./AppShell"
afterEach(cleanup)

it("opens the game directly from home and returns home", async () => {
  const user = userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "게임하기" }))
  expect(screen.getByRole("heading", { name: "멈추면 밀려나는 트랙" })).toBeVisible()
  await user.click(screen.getByRole("button", { name: "게임 라운지 나가기" }))
  expect(await screen.findByRole("heading", { name: "홈" })).toBeVisible()
})

it("opens the minigame from More and returns to the same utility surface", async () => {
  const user = userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "더보기" }))
  await user.click(screen.getByRole("button", { name: "미니게임" }))
  expect(screen.getByRole("heading", { name: "멈추면 밀려나는 트랙" })).toBeVisible()
  await user.click(screen.getByRole("button", { name: "게임 라운지 나가기" }))
  expect(await screen.findByRole("heading", { name: "더보기" })).toBeVisible()
})
