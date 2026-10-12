import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BodyDiagram } from "./BodyDiagram"
import { BODY_PART_FOCUS_ANCHORS } from "./BodyPartFocusView"
import type { BodyPartMetadataV1, OtherBodyPartId } from "../../domain/body-part-metadata"

const recentId = "other_123e4567-e89b-42d3-a456-426614174000" as OtherBodyPartId

afterEach(cleanup)

describe("body-part focus dialog", () => {
  it("uses approved bitmap crop anchors and identifies front/back without drawing overlays", async () => {
    const user = userEvent.setup()
    const { container } = render(<BodyDiagram />)

    await user.click(screen.getByRole("button", { name: "오른 종아리" }))

    const dialog = await screen.findByRole("dialog", { name: "오른 종아리 통증 정도" })
    const crop = dialog.querySelector(".body-part-focus-dialog__figure")
    const image = crop?.querySelector("img")
    expect(image?.getAttribute("src")).toMatch(/body-check-focus-back-v1\.webp$/u)
    expect(image?.getAttribute("alt")).toBe("뒷면 부위 위치 확대")
    expect(crop).toHaveAttribute("data-focus-side", "뒷면")
    expect(Number.parseFloat(image?.style.width ?? "0")).toBeCloseTo(220)
    expect(Number.parseFloat(image?.style.height ?? "0")).toBeCloseTo(220)
    expect(container.querySelector("svg")).not.toBeNull() // close icon only; no body SVG is used
    expect(BODY_PART_FOCUS_ANCHORS.rCalf).toEqual({ side: "back", x: 0.556, y: 0.795 })
  })

  it("closes with Escape without applying a level and restores focus to the opener", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BodyDiagram onChange={onChange} />)
    const opener = screen.getByRole("button", { name: "오른 무릎" })
    await user.click(opener)
    await screen.findByRole("dialog", { name: "오른 무릎 통증 정도" })

    await user.keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(onChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(opener)
  })

  it("lets browser Back close only the dialog and does not alter the draft", async () => {
    const onChange = vi.fn()
    render(<BodyDiagram onChange={onChange} />)
    await userEvent.setup().click(screen.getByRole("button", { name: "오른 무릎" }))
    await screen.findByRole("dialog", { name: "오른 무릎 통증 정도" })

    window.history.back()

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "오른 무릎" })).toBeInTheDocument()
  })

  it("wraps focus at both ends of the open dialog", async () => {
    const user = userEvent.setup()
    render(<BodyDiagram metadata={undefined} onMetadataChange={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: "기타 부위 추가" }))

    const dialog = await screen.findByRole("dialog", { name: "기타 부위 통증 정도" })
    const buttons = within(dialog).getAllByRole("button")
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    expect(first).toBeDefined()
    expect(last).toBeDefined()
    last?.focus()
    await user.tab()
    expect(document.activeElement).toBe(first)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(last)
  })

  it("does not show a crop image for a custom name and reuses a matching recent name only after explicit choice", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    render(<BodyDiagram
      metadata={undefined}
      onMetadataChange={onMetadataChange}
      recentCustomParts={[{ id: recentId, labelSnapshot: "발목 안쪽" }]}
    />)
    await user.click(screen.getByRole("button", { name: "기타 부위 추가" }))

    const dialog = await screen.findByRole("dialog", { name: "기타 부위 통증 정도" })
    expect(dialog.querySelector("img")).toBeNull()
    const name = within(dialog).getByRole("textbox", { name: "부위 이름" })
    expect(name).toHaveAttribute("maxLength", "48")
    await user.type(name, "발목 안쪽")
    await user.click(within(dialog).getByRole("button", { name: "최근 이름 “발목 안쪽” 재사용" }))
    expect(within(dialog).getByRole("textbox", { name: "부위 이름" })).toHaveValue("발목 안쪽")
    expect(dialog.querySelector("details")).not.toHaveAttribute("open")
    expect(dialog.querySelector(".body-part-focus-dialog__hint")).toHaveTextContent("5/48자")
    await user.click(within(dialog).getByRole("button", { name: "발목 안쪽 통증 3단계" }))

    expect(onMetadataChange).toHaveBeenCalledWith({
      schemaVersion: 1,
      observations: [{ id: recentId, labelSnapshot: "발목 안쪽", severity: 3 }],
    })
  })

  it("does not copy recent severity or note into a newly opened name selection", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    const metadata: BodyPartMetadataV1 = {
      schemaVersion: 1,
      observations: [{ id: recentId, labelSnapshot: "발목 안쪽", severity: 5, note: "이전 메모" }],
    }
    render(<BodyDiagram
      metadata={metadata}
      onMetadataChange={onMetadataChange}
      recentCustomParts={[{ id: recentId, labelSnapshot: "발목 안쪽" }]}
    />)

    await user.click(screen.getByRole("button", { name: "기타 부위 추가" }))
    const dialog = await screen.findByRole("dialog", { name: "기타 부위 통증 정도" })
    const name = within(dialog).getByRole("textbox", { name: "부위 이름" })
    await user.type(name, "발목 안쪽")
    await user.click(within(dialog).getByRole("button", { name: "최근 이름 “발목 안쪽” 재사용" }))
    await user.click(within(dialog).getByRole("button", { name: "발목 안쪽 통증 2단계" }))

    expect(onMetadataChange).toHaveBeenCalledWith({
      schemaVersion: 1,
      observations: [{ id: recentId, labelSnapshot: "발목 안쪽", severity: 2 }],
    })
  })

  it("creates an opaque ID only when a new custom part is applied", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    render(<BodyDiagram metadata={undefined} onMetadataChange={onMetadataChange} />)
    await user.click(screen.getByRole("button", { name: "기타 부위 추가" }))
    const dialog = await screen.findByRole("dialog", { name: "기타 부위 통증 정도" })
    await user.type(within(dialog).getByRole("textbox", { name: "부위 이름" }), "발바닥")
    await user.click(within(dialog).getByRole("button", { name: "발바닥 통증 4단계" }))

    const next = onMetadataChange.mock.calls[0]?.[0] as BodyPartMetadataV1 | undefined
    expect(next?.schemaVersion).toBe(1)
    expect(next?.observations).toHaveLength(1)
    expect(next?.observations[0]).toMatchObject({ labelSnapshot: "발바닥", severity: 4 })
    expect(next?.observations[0]?.id).toMatch(/^other_[a-f0-9-]{36}$/u)
    expect(next?.observations[0]).not.toHaveProperty("note")
  })

  it("injects and rejects a 49-character name rather than trusting the input maxLength", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    render(<BodyDiagram metadata={undefined} onMetadataChange={onMetadataChange} />)
    await user.click(screen.getByRole("button", { name: "기타 부위 추가" }))
    const dialog = await screen.findByRole("dialog", { name: "기타 부위 통증 정도" })
    const name = within(dialog).getByRole("textbox", { name: "부위 이름" })
    fireEvent.change(name, { target: { value: "a".repeat(49) } })
    await user.click(within(dialog).getByRole("button", { name: /통증 1단계$/u }))

    expect(name).toHaveAttribute("aria-invalid", "true")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("48자까지")
    expect(onMetadataChange).not.toHaveBeenCalled()
  })

  it("injects and rejects a memo beyond the limit", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    render(<BodyDiagram metadata={undefined} onMetadataChange={onMetadataChange} />)
    await user.click(screen.getByRole("button", { name: "기타 부위 추가" }))
    const dialog = await screen.findByRole("dialog", { name: "기타 부위 통증 정도" })
    await user.type(within(dialog).getByRole("textbox", { name: "부위 이름" }), "발목 안쪽")
    await user.click(within(dialog).getByText("추가 메모"))
    const note = within(dialog).getByRole("textbox", { name: "메모" })
    fireEvent.change(note, { target: { value: "m".repeat(501) } })
    await user.click(within(dialog).getByRole("button", { name: "발목 안쪽 통증 2단계" }))

    expect(note).toHaveAttribute("aria-invalid", "true")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("500자까지")
    expect(onMetadataChange).not.toHaveBeenCalled()
  })

  it("retains an explicit empty metadata object after clearing the last custom part", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    const metadata: BodyPartMetadataV1 = {
      schemaVersion: 1,
      observations: [{ id: recentId, labelSnapshot: "발목 안쪽", severity: 2, note: "임시 메모" }],
    }
    render(<BodyDiagram metadata={metadata} onMetadataChange={onMetadataChange} />)
    await user.click(screen.getByRole("button", { name: "발목 안쪽, 통증 2/5" }))
    const dialog = await screen.findByRole("dialog", { name: "발목 안쪽 통증 정도" })
    await user.click(within(dialog).getByRole("button", { name: "발목 안쪽 통증 해제" }))

    expect(onMetadataChange).toHaveBeenCalledWith({ schemaVersion: 1, observations: [] })
  })

  it("keeps part controls available when the enlarged bitmap fails to load", async () => {
    const user = userEvent.setup()
    render(<BodyDiagram />)
    await user.click(screen.getByRole("button", { name: "오른 무릎" }))
    const dialog = await screen.findByRole("dialog", { name: "오른 무릎 통증 정도" })
    fireEvent.error(dialog.querySelector("img") as HTMLImageElement)

    expect(dialog.querySelector("img")).not.toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "오른 무릎 통증 4단계" })).toBeVisible()
  })
})
