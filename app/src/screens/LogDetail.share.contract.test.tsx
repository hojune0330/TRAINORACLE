import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { LogDetail } from "./LogDetail"
import type { PostSessionEntry } from "../domain/journal-schema"
import { replaceAllEntries } from "../domain/journal-store"
import { renderJournalSharePng } from "../domain/journal-share-card"
import { downloadMemo } from "../domain/workout-memo-export"
import { loadDecorationState } from "../domain/decorations"

vi.mock("../domain/journal-share-card", async importOriginal => ({ ...await importOriginal<typeof import("../domain/journal-share-card")>(), renderJournalSharePng: vi.fn() }))
vi.mock("../domain/workout-memo-export", async importOriginal => ({ ...await importOriginal<typeof import("../domain/workout-memo-export")>(), downloadMemo: vi.fn() }))

const entry: PostSessionEntry = { id: "share-test", kind: "post-session", date: "2026-10-26", savedAt: "2026-10-26T09:00:00Z", syncState: "local", title: "운동", system: "base", distanceKm: "4.6", durationMin: "30", avgPace: "", rpe: 4, memo: "" }
beforeEach(async () => {
  localStorage.clear()
  await initializeCanonicalJournalFixture()
  // Set up the existing starter decorations before checking share-only writes.
  loadDecorationState()
  vi.mocked(renderJournalSharePng).mockReset().mockResolvedValue(new Blob(["synthetic-png"], { type: "image/png" }))
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:share-preview") })
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
})
afterEach(cleanup)

it("offers a share card on a fully loaded saved exercise without making storage writes", () => {
  const before = { ...localStorage }
  render(<LogDetail date={entry.date} entries={[entry]} readComplete />)
  expect(screen.getByRole("button", { name: "공유 카드 만들기" })).toBeVisible()
  expect({ ...localStorage }).toEqual(before)
})

it("does not expose export in read-only readers, incomplete reads, or a blank numeric entry", () => {
  const { rerender } = render(<LogDetail date={entry.date} entries={[entry]} readComplete readOnly />)
  expect(screen.queryByRole("button", { name: "공유 카드 만들기" })).toBeNull()
  rerender(<LogDetail date={entry.date} entries={[entry]} readComplete={false} />)
  expect(screen.queryByRole("button", { name: "공유 카드 만들기" })).toBeNull()
  rerender(<LogDetail date={entry.date} entries={[{ ...entry, distanceKm: "", durationMin: "" }]} readComplete />)
  expect(screen.queryByRole("button", { name: "공유 카드 만들기" })).toBeNull()
})

it.each(["distinct", "duplicate"] as const)("shares the selected second exercise with %s stored ids without changing the journal", async identity => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
  const second = { ...entry, id: identity === "duplicate" ? entry.id : "second-exercise", savedAt: "2026-10-26T10:00:00Z", distanceKm: "7", durationMin: "42" }
  expect(replaceAllEntries([entry, second]).ok).toBe(true)
  const before = { ...localStorage }
  render(<LogDetail date={entry.date} />)

  const selector = screen.getByRole("combobox", { name: "공유할 운동" })
  const options = within(selector).getAllByRole<HTMLOptionElement>("option")
  fireEvent.change(selector, { target: { value: options[1]!.value } })
  fireEvent.click(screen.getByRole("button", { name: "공유 카드 만들기" }))

  await waitFor(() => expect(renderJournalSharePng).toHaveBeenLastCalledWith(expect.objectContaining({ metrics: [{ label: "거리", value: "7 km" }, { label: "시간", value: "42분" }] }), expect.anything()))
  expect(new Set(options.map(option => option.value)).size).toBe(2)
  expect(consoleError.mock.calls.flat().join(" ")).not.toContain("Encountered two children with the same key")
  expect({ ...localStorage }).toEqual(before)
})

it("discards a pending image when the selected duplicate record disappears", async () => {
  const second = { ...entry, distanceKm: "7", savedAt: "2026-10-26T10:00:00Z" }
  let finish!: (blob: Blob) => void
  vi.mocked(renderJournalSharePng).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const before = { ...localStorage }
  const { rerender } = render(<LogDetail date={entry.date} entries={[entry, second]} readComplete />)
  const selector = screen.getByRole("combobox", { name: "공유할 운동" })
  fireEvent.change(selector, { target: { value: within(selector).getAllByRole<HTMLOptionElement>("option")[1]!.value } })
  fireEvent.click(screen.getByRole("button", { name: "공유 카드 만들기" }))
  expect(renderJournalSharePng).toHaveBeenLastCalledWith(expect.objectContaining({ metrics: expect.arrayContaining([{ label: "거리", value: "7 km" }]) }), expect.anything())

  rerender(<LogDetail date={entry.date} entries={[entry]} readComplete />)
  await act(async () => { finish(new Blob(["removed-record-image"])) })
  expect(screen.queryByRole("button", { name: "이미지 저장" })).toBeNull()
  expect(URL.createObjectURL).not.toHaveBeenCalled()
  expect(downloadMemo).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: "공유 카드 만들기" }))
  await waitFor(() => expect(renderJournalSharePng).toHaveBeenLastCalledWith(expect.objectContaining({ metrics: expect.arrayContaining([{ label: "거리", value: "4.6 km" }]) }), expect.anything()))
  expect({ ...localStorage }).toEqual(before)
})

it("invalidates the previous preview while the selected record is updated", async () => {
  const second = { ...entry, id: "second-exercise", distanceKm: "7", savedAt: "2026-10-26T10:00:00Z" }
  const before = { ...localStorage }
  const { rerender } = render(<LogDetail date={entry.date} entries={[entry, second]} readComplete />)
  const selector = screen.getByRole("combobox", { name: "공유할 운동" })
  fireEvent.change(selector, { target: { value: within(selector).getAllByRole<HTMLOptionElement>("option")[1]!.value } })
  fireEvent.click(screen.getByRole("button", { name: "공유 카드 만들기" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "이미지 저장" })).toBeEnabled())

  let finish!: (blob: Blob) => void
  vi.mocked(renderJournalSharePng).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  rerender(<LogDetail date={entry.date} entries={[entry, { ...second, distanceKm: "8" }]} readComplete />)
  expect(renderJournalSharePng).toHaveBeenLastCalledWith(expect.objectContaining({ metrics: expect.arrayContaining([{ label: "거리", value: "8 km" }]) }), expect.anything())
  expect(screen.getByRole("button", { name: "이미지 저장" })).toBeDisabled()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:share-preview")
  fireEvent.click(screen.getByRole("button", { name: "이미지 저장" }))
  expect(downloadMemo).not.toHaveBeenCalled()

  const updatedImage = new Blob(["updated-record-image"], { type: "image/png" })
  await act(async () => { finish(updatedImage) })
  fireEvent.click(screen.getByRole("button", { name: "이미지 저장" }))
  expect(downloadMemo).toHaveBeenCalledWith(updatedImage, "trainoracle-journal.png")
  expect({ ...localStorage }).toEqual(before)
})
