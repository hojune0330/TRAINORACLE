import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { JournalDecorationSurface } from "./JournalDecorationSurface"

beforeEach(() => {
  localStorage.clear()
  setActiveLocalAccount(null)
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  setActiveLocalAccount(null)
})

function renderOpenStudio() {
  return render(
    <JournalDecorationSurface date="2026-10-02" previewMonth="2026-10" initiallyOpen hasEntries>
      <article>일지 본문</article>
    </JournalDecorationSurface>,
  )
}

describe("JournalDecorationSurface calendar decoration flow", () => {
  it("keeps the small decorating guide outside the paper and removes it during material editing or calendar editing", async () => {
    const view = renderOpenStudio()
    expect(await screen.findByRole("heading", { level: 1, name: "일지 꾸미기" })).toHaveClass("app-heading--screen")
    expect(screen.queryByText("이 일지 꾸미기")).toBeNull()
    const illustration = () => view.container.querySelector('img[src$="decorating-kit-v2.webp"]')
    expect(illustration()).toHaveAttribute("width", "64")
    expect(illustration()?.closest(".journal-decoration-unified__header")).not.toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "꾸미기 재료 도구" }))
    expect(illustration()).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /^달력$/u }))
    expect(screen.getByRole("dialog", { name: "달력 꾸미기" })).toBeVisible()
    expect(await screen.findByRole("heading", { level: 2, name: "여백 배치" })).toBeVisible()
    expect(illustration()).toBeNull()
    expect(await screen.findByRole("button", { name: "재료 서랍 열기" })).toBeEnabled()
  })
  it("offers apply, keep editing, and discard when leaving a dirty calendar draft", async () => {
    renderOpenStudio()
    fireEvent.click(screen.getByRole("button", { name: /^달력$/u }))
    fireEvent.click(await screen.findByRole("button", { name: "재료 서랍 열기" }))
    fireEvent.click(screen.getByRole("button", { name: /^테마$/u }))
    fireEvent.click(await screen.findByRole("button", { name: /모눈 연습장 적용하기/u }))

    fireEvent.click(screen.getByRole("button", { name: /^일지$/u }))
    const dialog = await screen.findByRole("alertdialog", { name: "달력 변경을 적용할까요?" })
    expect(dialog).toBeVisible()
    expect(screen.getByRole("button", { name: "적용하고 나가기" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "계속 편집" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "변경 버리기" })).toBeEnabled()

    fireEvent.click(screen.getByRole("button", { name: "계속 편집" }))
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(screen.getByRole("button", { name: /^달력$/u })).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(screen.getByRole("button", { name: /^일지$/u }))
    fireEvent.click(await screen.findByRole("button", { name: "변경 버리기" }))
    expect(await screen.findByRole("button", { name: /^일지$/u })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("applies the calendar draft before switching targets", async () => {
    renderOpenStudio()
    fireEvent.click(screen.getByRole("button", { name: /^달력$/u }))
    fireEvent.click(await screen.findByRole("button", { name: "재료 서랍 열기" }))
    fireEvent.click(screen.getByRole("button", { name: /^테마$/u }))
    fireEvent.click(await screen.findByRole("button", { name: /모눈 연습장 적용하기/u }))
    fireEvent.click(screen.getByRole("button", { name: /^일지$/u }))
    fireEvent.click(await screen.findByRole("button", { name: "적용하고 나가기" }))

    await waitFor(() => expect(screen.getByRole("button", { name: /^일지$/u })).toHaveAttribute("aria-pressed", "true"))
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("resets the calendar editing session on owner change without leaking its draft", async () => {
    renderOpenStudio()
    fireEvent.click(screen.getByRole("button", { name: /^달력$/u }))
    fireEvent.click(await screen.findByRole("button", { name: "재료 서랍 열기" }))
    fireEvent.click(screen.getByRole("button", { name: /^테마$/u }))
    fireEvent.click(await screen.findByRole("button", { name: /모눈 연습장 적용하기/u }))

    setActiveLocalAccount("synthetic-calendar-owner-b")

    await waitFor(() => expect(screen.getByRole("button", { name: /^일지$/u })).toHaveAttribute("aria-pressed", "true"))
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })
})
