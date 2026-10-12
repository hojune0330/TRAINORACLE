import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { Trends } from "../Trends"

// A plan can produce a starting summary even before any workout is recorded.
vi.mock("../../domain/personal-oracle", () => ({ derivePersonalOracle: () => ({ maturity: "STARTING" }) }))
vi.mock("./PersonalOraclePanel", () => ({ PersonalOraclePanel: () => null }))
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(cleanup)

it("keeps import and PB actions direct when a plan exists without workout records", () => {
  const onImport = vi.fn(), onRecords = vi.fn()
  render(<Trends onOpenImport={onImport} onOpenRecords={onRecords} />)
  expect(screen.getByRole("button", { name: /운동 파일 가져오기/ })).toBeVisible()
  expect(screen.getByRole("region", { name: "이미 있는 기록으로 시작하기" })).toBeVisible()
  expect(screen.queryByText("운동 파일·최고기록 추가")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: /운동 파일 가져오기/ }))
  fireEvent.click(screen.getByRole("button", { name: /최고기록 남기기/ }))
  expect(onImport).toHaveBeenCalledOnce()
  expect(onRecords).toHaveBeenCalledOnce()
})
