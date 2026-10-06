import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { RecordStartActions } from "./RecordStartActions"
afterEach(cleanup)

it("offers two real entrypoints and explains unsupported health archives only on demand", () => {
  const onImport = vi.fn(), onRecords = vi.fn()
  render(<RecordStartActions onImport={onImport} onRecords={onRecords} />)
  fireEvent.click(screen.getByRole("button", { name: /운동 파일 가져오기/ }))
  fireEvent.click(screen.getByRole("button", { name: /최고기록 남기기/ }))
  expect(onImport).toHaveBeenCalledOnce()
  expect(onRecords).toHaveBeenCalledOnce()
  expect(screen.getByText(/자동으로 받는 기능은 준비 중/)).not.toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "워치·건강앱 기록은 어떻게 가져오나요?" }))
  expect(screen.getByText(/전체 백업 ZIP·XML/)).toBeVisible()
})
