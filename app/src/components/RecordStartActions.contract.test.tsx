import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { RecordStartActions } from "./RecordStartActions"
afterEach(cleanup)

it("offers two direct entrypoints without duplicating the import screen's preparation help", () => {
  const onImport = vi.fn(), onRecords = vi.fn()
  render(<RecordStartActions onImport={onImport} onRecords={onRecords} />)
  fireEvent.click(screen.getByRole("button", { name: /운동 파일 가져오기/ }))
  fireEvent.click(screen.getByRole("button", { name: /최고기록 남기기/ }))
  expect(onImport).toHaveBeenCalledOnce()
  expect(onRecords).toHaveBeenCalledOnce()
  expect(screen.getAllByRole("button")).toHaveLength(2)
  expect(screen.queryByText(/자동으로 받는 기능은 준비 중/)).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "워치·건강앱 기록은 어떻게 가져오나요?" })).not.toBeInTheDocument()
  // Unsupported archives and manual-vs-automatic linking stay covered by
  // ImportActivities.contract.test.tsx at the actual file-preparation entry.
})
