import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { JournalShareTool } from "./JournalShareTool"
import { renderJournalSharePng, type JournalShareCard } from "../domain/journal-share-card"
import { downloadMemo } from "../domain/workout-memo-export"

const owner = vi.hoisted(() => ({ scope: 0, change: () => {} }))
vi.mock("../domain/account/local-journal-ownership", () => ({ localJournalScopeGeneration: () => owner.scope, onLocalJournalScopeChange: (callback: () => void) => { owner.change = callback; return () => {} } }))
vi.mock("../domain/journal-share-card", async importOriginal => ({ ...await importOriginal<typeof import("../domain/journal-share-card")>(), renderJournalSharePng: vi.fn() }))
vi.mock("../domain/workout-memo-export", async importOriginal => ({ ...await importOriginal<typeof import("../domain/workout-memo-export")>(), downloadMemo: vi.fn() }))
const card: JournalShareCard = { example: true, date: "2025-03-02", title: "오늘을 남긴 한 페이지", source: "가상 기록", metrics: [{ label: "거리", value: "4.6 km" }] }
beforeEach(() => {
  owner.scope = 0
  vi.mocked(renderJournalSharePng).mockResolvedValue(new Blob(["synthetic-png"], { type: "image/png" }))
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") })
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
  Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

it("waits for a real preview, saves its exact blob, and never writes a journal", async () => {
  const before = { ...localStorage }
  render(<JournalShareTool card={card} />)
  expect(renderJournalSharePng).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "공유 카드 만들기" }))
  expect(screen.getByRole("button", { name: "이미지 저장" })).toBeDisabled()
  await waitFor(() => expect(screen.getByRole("button", { name: "이미지 저장" })).toBeEnabled())
  expect(screen.getByRole("img")).toHaveAccessibleName(/예시 · 가상 기록/u)
  expect(screen.getByRole("checkbox", { name: "날짜 넣기" })).not.toBeChecked()
  fireEvent.click(screen.getByRole("button", { name: "이미지 저장" }))
  expect(downloadMemo).toHaveBeenCalledWith(await vi.mocked(renderJournalSharePng).mock.results[0]!.value, "trainoracle-example.png")
  expect({ ...localStorage }).toEqual(before)
})

it("invalidates the old image while the selected style is being rendered", async () => {
  render(<JournalShareTool card={card} />)
  fireEvent.click(screen.getByRole("button", { name: "공유 카드 만들기" }))
  await screen.findByRole("img")
  vi.mocked(renderJournalSharePng).mockReturnValueOnce(new Promise(() => {}))
  fireEvent.click(screen.getByRole("button", { name: "분홍 종이" }))
  expect(screen.getByRole("button", { name: "이미지 저장" })).toBeDisabled()
  expect(screen.queryByRole("img")).toBeNull()
})

it("cancels stale generation after close and restores focus", async () => {
  let finish!: (blob: Blob) => void
  vi.mocked(renderJournalSharePng).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  render(<JournalShareTool card={card} />)
  const opener = screen.getByRole("button", { name: "공유 카드 만들기" })
  fireEvent.click(opener)
  fireEvent.keyDown(screen.getByRole("button", { name: "공유 카드 닫기" }), { key: "Escape" })
  finish(new Blob(["stale"]))
  await waitFor(() => expect(opener).toHaveFocus())
  expect(URL.createObjectURL).not.toHaveBeenCalled()
  expect(downloadMemo).not.toHaveBeenCalled()
})

it("offers retry on renderer failure and blocks export after an account change", async () => {
  vi.mocked(renderJournalSharePng).mockRejectedValueOnce(new Error("image missing"))
  render(<JournalShareTool card={card} />)
  fireEvent.click(screen.getByRole("button", { name: "공유 카드 만들기" }))
  fireEvent.click(await screen.findByRole("button", { name: "다시 만들기" }))
  await screen.findByRole("img")
  owner.scope++
  fireEvent.click(screen.getByRole("button", { name: "공유" }))
  expect(downloadMemo).not.toHaveBeenCalled()
})

it("uses download fallback without claiming social posting succeeded", async () => {
  render(<JournalShareTool card={card} />)
  fireEvent.click(screen.getByRole("button", { name: "공유 카드 만들기" }))
  await screen.findByRole("img")
  fireEvent.click(screen.getByRole("button", { name: "공유" }))
  expect(downloadMemo).toHaveBeenCalledOnce()
  expect(screen.getByRole("status")).toHaveTextContent("원하는 앱에서 올려 주세요")
})

it("keeps canceled native sharing quiet and does not silently download", async () => {
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true })
  Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn().mockRejectedValue(new DOMException("canceled", "AbortError")) })
  render(<JournalShareTool card={card} />)
  fireEvent.click(screen.getByRole("button", { name: "공유 카드 만들기" }))
  await screen.findByRole("img")
  fireEvent.click(screen.getByRole("button", { name: "공유" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "공유" })).toBeEnabled())
  expect(navigator.share).toHaveBeenCalledOnce()
  expect(downloadMemo).not.toHaveBeenCalled()
  expect(screen.queryByRole("status")).toBeNull()
})
