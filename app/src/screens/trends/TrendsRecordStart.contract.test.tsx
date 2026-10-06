import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { Trends } from "../Trends"

// A plan can produce a starting summary even before any workout is recorded.
vi.mock("../../domain/personal-oracle", () => ({ derivePersonalOracle: () => ({ maturity: "STARTING" }) }))
vi.mock("./PersonalOraclePanel", () => ({ PersonalOraclePanel: () => null }))
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(cleanup)

it("keeps import and PB actions visible when a plan summary exists but workout records do not", () => {
  const onImport = vi.fn(), onRecords = vi.fn()
  render(<Trends onOpenImport={onImport} onOpenRecords={onRecords} />)
  fireEvent.click(screen.getByRole("button", { name: /운동 파일 가져오기/ }))
  fireEvent.click(screen.getByRole("button", { name: /최고기록 남기기/ }))
  expect(onImport).toHaveBeenCalledOnce()
  expect(onRecords).toHaveBeenCalledOnce()
})
