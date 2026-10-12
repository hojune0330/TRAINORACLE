import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ProductAnnouncement } from "./ProductAnnouncement"
import { acknowledgeAnnouncement, announcementKey, MINIGAME_ANNOUNCEMENT } from "../domain/product-announcements"

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })

it("dismisses persistently without opening, and only a new version is offered again", () => {
  const notice = { ...MINIGAME_ANNOUNCEMENT, id: "dismiss-test" }
  const onOpen = vi.fn()
  const { unmount } = render(<ProductAnnouncement notice={notice} onOpen={onOpen} />)
  fireEvent.click(screen.getByRole("button", { name: /안내 닫기/ }))
  expect(screen.queryByRole("complementary", { name: "새 소식" })).toBeNull()
  expect(localStorage.getItem(announcementKey(notice))).toBe("acknowledged")
  expect(onOpen).not.toHaveBeenCalled()
  unmount()
  const next = render(<ProductAnnouncement notice={notice} onOpen={onOpen} />)
  expect(screen.queryByRole("button", { name: "게임하기" })).toBeNull()
  next.rerender(<ProductAnnouncement notice={{ ...notice, version: 2 }} onOpen={onOpen} />)
  expect(screen.getByRole("button", { name: "게임하기" })).toBeVisible()
})

it("honors stored acknowledgement after a fresh load and disabled releases", () => {
  const notice = { ...MINIGAME_ANNOUNCEMENT, id: "stored-test" }
  localStorage.setItem(announcementKey(notice), "acknowledged")
  const { rerender } = render(<ProductAnnouncement notice={notice} onOpen={vi.fn()} />)
  expect(screen.queryByRole("button", { name: "게임하기" })).toBeNull()
  rerender(<ProductAnnouncement notice={{ ...notice, version: 2, enabled: false }} onOpen={vi.fn()} />)
  expect(screen.queryByRole("button", { name: "게임하기" })).toBeNull()
})

it("opens once and stays dismissed when browser storage is blocked", () => {
  const notice = { ...MINIGAME_ANNOUNCEMENT, id: "blocked-test" }
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked") })
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
  const onOpen = vi.fn()
  const { unmount } = render(<ProductAnnouncement notice={notice} onOpen={onOpen} />)
  fireEvent.click(screen.getByRole("button", { name: "게임하기" }))
  expect(onOpen).toHaveBeenCalledTimes(1)
  unmount()
  render(<ProductAnnouncement notice={notice} onOpen={onOpen} />)
  expect(screen.queryByRole("button", { name: "게임하기" })).toBeNull()
})

it("hides when the feature is opened elsewhere or another tab acknowledges it", () => {
  const notice = { ...MINIGAME_ANNOUNCEMENT, id: "elsewhere-test" }
  const { rerender } = render(<ProductAnnouncement notice={notice} onOpen={vi.fn()} />)
  fireEvent(window, new Event("storage"))
  expect(screen.getByRole("button", { name: "게임하기" })).toBeVisible()
  // Dispatch through a real alternate entry, as the More menu does.
  act(() => acknowledgeAnnouncement(notice))
  expect(screen.queryByRole("button", { name: "게임하기" })).toBeNull()
  rerender(<ProductAnnouncement notice={{ ...notice, version: 2 }} onOpen={vi.fn()} />)
  localStorage.setItem(announcementKey({ ...notice, version: 2 }), "acknowledged")
  fireEvent(window, new Event("storage"))
  expect(screen.queryByRole("button", { name: "게임하기" })).toBeNull()
})
