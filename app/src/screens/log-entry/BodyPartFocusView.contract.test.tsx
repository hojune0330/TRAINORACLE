import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BodyDiagram } from "./BodyDiagram"
import { BODY_PART_FOCUS_ANCHORS } from "./BodyPartFocusView"
import type { BodyPartMetadataV1, OtherBodyPartId } from "../../domain/body-part-metadata"

const recentId = "other_123e4567-e89b-42d3-a456-426614174000" as OtherBodyPartId
type TestUser = ReturnType<typeof userEvent.setup>

async function openKnownPart(user: TestUser, group: string, part: string, title: string) {
  await user.click(screen.getByRole("button", { name: group }))
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: part }))
  return screen.findByRole("dialog", { name: title })
}

async function openCustomPart(user: TestUser) {
  if (!screen.queryByRole("button", { name: "기타 부위 추가" })) {
    await user.click(screen.getByRole("button", { name: "다른 부위 추가" }))
  }
  await user.click(screen.getByRole("button", { name: "기타 부위 추가" }))
  return screen.findByRole("dialog", { name: "기타 부위" })
}

afterEach(cleanup)

describe("body-part focus dialog", () => {
  it("uses generated v2 bitmap anchors with a separate marker and explicit front/back", async () => {
    const user = userEvent.setup()
    render(<BodyDiagram />)
    const dialog = await openKnownPart(user, "종아리", "오른 종아리", "내 오른쪽 종아리")
    const crop = dialog.querySelector(".body-part-focus-dialog__figure")
    const image = crop?.querySelector("img")
    expect(image?.getAttribute("src")).toMatch(/body-check-focus-back-v2\.webp$/u)
    expect(image?.getAttribute("alt")).toBe("내 오른쪽 종아리 위치 · 뒷면")
    expect(crop).toHaveAttribute("data-focus-side", "뒷면")
    expect(Number.parseFloat(image?.style.width ?? "0")).toBeCloseTo(220)
    expect(Number.parseFloat(image?.style.height ?? "0")).toBeCloseTo(220)
    expect(crop?.querySelector("svg, canvas")).toBeNull()
    expect(crop?.querySelectorAll(".body-part-focus-dialog__marker")).toHaveLength(1)
    expect(crop?.querySelector(".body-part-focus-dialog__marker")).toHaveAttribute("aria-hidden", "true")
    expect(BODY_PART_FOCUS_ANCHORS.rCalf).toEqual({ side: "back", x: 0.556, y: 0.800 })
    expect(BODY_PART_FOCUS_ANCHORS.rKnee.x).toBeLessThan(BODY_PART_FOCUS_ANCHORS.lKnee.x)
    expect(BODY_PART_FOCUS_ANCHORS.rCalf.x).toBeGreaterThan(BODY_PART_FOCUS_ANCHORS.lCalf.x)
  })

  it("asks for an explicit side after six groups and applies nothing before a level", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BodyDiagram onChange={onChange} />)
    const groups = within(screen.getByRole("group", { name: "몸 부위 선택" })).getAllByRole("button")
    expect(groups.map(button => button.textContent)).toEqual(["무릎", "종아리", "허벅지 뒤", "발", "정강이", "허리"])
    expect(screen.queryByRole("button", { name: "오른 무릎" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "무릎" }))
    const dialog = await screen.findByRole("dialog", { name: "무릎 · 어느 쪽인가요?" })
    expect(within(dialog).queryByRole("group", { name: "통증 정도" })).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "왼 무릎" }))
    expect(dialog).toHaveAccessibleName("내 왼쪽 무릎")
    expect(within(dialog).queryByRole("button", { name: "왼 무릎 선택 취소" })).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "왼 무릎 통증 2단계" }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ lKnee: 2 })
    expect(dialog).toHaveAccessibleName("선택한 부위")
  })

  it("keeps two consecutive selections in one dialog until explicit input completion", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    function ControlledBody() {
      const [selected, setSelected] = React.useState<Record<string, number>>({})
      return <BodyDiagram selected={selected} onChange={next => { onChange(next); setSelected(next) }} />
    }
    render(<ControlledBody />)
    const dialog = await openKnownPart(user, "무릎", "왼 무릎", "내 왼쪽 무릎")
    await user.click(within(dialog).getByRole("button", { name: "왼 무릎 통증 2단계" }))
    expect(screen.getByRole("dialog", { name: "선택한 부위" })).toBe(dialog)
    await user.click(within(dialog).getByRole("button", { name: "다른 부위 추가" }))
    await user.click(within(dialog).getByRole("button", { name: "종아리" }))
    await user.click(within(dialog).getByRole("button", { name: "오른 종아리" }))
    await user.click(within(dialog).getByRole("button", { name: "오른 종아리 통증 3단계" }))
    expect(onChange).toHaveBeenNthCalledWith(1, { lKnee: 2 })
    expect(onChange).toHaveBeenNthCalledWith(2, { lKnee: 2, rCalf: 3 })
    expect(screen.getAllByRole("dialog")).toEqual([dialog])
    expect(within(dialog).getByRole("button", { name: "왼 무릎, 통증 2/5" })).toBeVisible()
    expect(within(dialog).getByRole("button", { name: "오른 종아리, 통증 3/5" })).toBeVisible()
    await user.click(within(dialog).getByRole("button", { name: "입력 완료" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: "왼 무릎, 통증 2/5" })).toBeVisible()
    expect(screen.getByRole("button", { name: "오른 종아리, 통증 3/5" })).toBeVisible()
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it("uses Escape for the picker before closing and restores focus without applying a level", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BodyDiagram onChange={onChange} />)
    const opener = screen.getByRole("button", { name: "무릎" })
    const dialog = await openKnownPart(user, "무릎", "오른 무릎", "내 오른쪽 무릎")
    await user.keyboard("{Escape}")
    await waitFor(() => expect(dialog).toHaveAccessibleName("불편한 곳을 골라요"))
    expect(screen.getAllByRole("dialog")).toEqual([dialog])
    expect(onChange).not.toHaveBeenCalled()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(onChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(opener)
  })

  it("lets browser Back visit the picker then close without altering the draft", async () => {
    const onChange = vi.fn()
    render(<BodyDiagram onChange={onChange} />)
    const dialog = await openKnownPart(userEvent.setup(), "무릎", "오른 무릎", "내 오른쪽 무릎")
    window.history.back()
    await waitFor(() => expect(dialog).toHaveAccessibleName("불편한 곳을 골라요"))
    expect(onChange).not.toHaveBeenCalled()
    window.history.back()
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "무릎" })).toBeInTheDocument()
  })

  it("wraps focus at both enabled ends of the open dialog", async () => {
    const user = userEvent.setup()
    render(<BodyDiagram onMetadataChange={vi.fn()} />)
    const dialog = await openCustomPart(user)
    const buttons = within(dialog).getAllByRole("button").filter(button => !button.hasAttribute("disabled"))
    const first = buttons[0], last = buttons[buttons.length - 1]
    expect(first).toBeDefined()
    expect(last).toBeDefined()
    last?.focus()
    await user.tab()
    expect(document.activeElement).toBe(first)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(last)
  })

  it("does not show a crop for a custom name and reuses its recent ID only after explicit apply", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    render(<BodyDiagram onMetadataChange={onMetadataChange}
      recentCustomParts={[{ id: recentId, labelSnapshot: "발목 안쪽" }]} />)
    const dialog = await openCustomPart(user)
    expect(dialog.querySelector("img")).toBeNull()
    const name = within(dialog).getByRole("textbox", { name: "부위 이름" })
    expect(name).toHaveAttribute("maxLength", "48")
    await user.type(name, "발목 안쪽")
    await user.click(within(dialog).getByRole("button", { name: "최근 이름 “발목 안쪽” 재사용" }))
    expect(name).toHaveValue("발목 안쪽")
    expect(dialog.querySelector("details")).not.toHaveAttribute("open")
    expect(dialog.querySelector(".body-part-focus-dialog__hint")).toHaveTextContent("5/48자")
    await user.click(within(dialog).getByRole("button", { name: "발목 안쪽 통증 3단계" }))
    expect(onMetadataChange).not.toHaveBeenCalled()
    expect(dialog).toHaveAccessibleName("기타 부위")
    await user.click(within(dialog).getByRole("button", { name: "추가" }))
    expect(onMetadataChange).toHaveBeenCalledExactlyOnceWith({
      schemaVersion: 1, observations: [{ id: recentId, labelSnapshot: "발목 안쪽", severity: 3 }],
    })
  })

  it("does not copy recent severity or note into a newly opened name selection", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    const metadata: BodyPartMetadataV1 = {
      schemaVersion: 1, observations: [{ id: recentId, labelSnapshot: "발목 안쪽", severity: 5, note: "이전 메모" }],
    }
    render(<BodyDiagram metadata={metadata} onMetadataChange={onMetadataChange}
      recentCustomParts={[{ id: recentId, labelSnapshot: "발목 안쪽" }]} />)
    const dialog = await openCustomPart(user)
    await user.type(within(dialog).getByRole("textbox", { name: "부위 이름" }), "발목 안쪽")
    await user.click(within(dialog).getByRole("button", { name: "최근 이름 “발목 안쪽” 재사용" }))
    expect(within(dialog).getByRole("button", { name: "추가" })).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "발목 안쪽 통증 5단계" })).toHaveAttribute("aria-pressed", "false")
    await user.click(within(dialog).getByText("메모 추가"))
    expect(within(dialog).getByRole("textbox", { name: "메모" })).toHaveValue("")
    await user.click(within(dialog).getByRole("button", { name: "발목 안쪽 통증 2단계" }))
    expect(onMetadataChange).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "추가" }))
    expect(onMetadataChange).toHaveBeenCalledExactlyOnceWith({
      schemaVersion: 1, observations: [{ id: recentId, labelSnapshot: "발목 안쪽", severity: 2 }],
    })
  })

  it("creates an opaque ID only when a new custom part is applied", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    render(<BodyDiagram onMetadataChange={onMetadataChange} />)
    const dialog = await openCustomPart(user)
    await user.type(within(dialog).getByRole("textbox", { name: "부위 이름" }), "발바닥")
    await user.click(within(dialog).getByRole("button", { name: "발바닥 통증 4단계" }))
    expect(onMetadataChange).not.toHaveBeenCalled()
    expect(within(dialog).queryByRole("button", { name: "발바닥 선택 취소" })).toBeNull()
    await user.click(within(dialog).getByRole("button", { name: "추가" }))
    const next = onMetadataChange.mock.calls[0]?.[0] as BodyPartMetadataV1 | undefined
    expect(next?.schemaVersion).toBe(1)
    expect(next?.observations).toHaveLength(1)
    expect(next?.observations[0]).toMatchObject({ labelSnapshot: "발바닥", severity: 4 })
    expect(next?.observations[0]?.id).toMatch(/^other_[a-f0-9-]{36}$/u)
    expect(next?.observations[0]).not.toHaveProperty("note")
  })

  it("retains an unapplied custom name note and severity while returning through the internal picker", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    render(<BodyDiagram onMetadataChange={onMetadataChange} />)
    const dialog = await openCustomPart(user)
    await user.type(within(dialog).getByRole("textbox", { name: "부위 이름" }), "발바닥")
    await user.click(within(dialog).getByText("메모 추가"))
    await user.type(within(dialog).getByRole("textbox", { name: "메모" }), "합성 부위 메모")
    await user.click(within(dialog).getByRole("button", { name: "발바닥 통증 4단계" }))
    await user.click(within(dialog).getByRole("button", { name: "부위 선택으로" }))
    await waitFor(() => expect(dialog).toHaveAccessibleName("불편한 곳을 골라요"))
    expect(onMetadataChange).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "기타 부위 추가" }))
    expect(within(dialog).getByRole("textbox", { name: "부위 이름" })).toHaveValue("발바닥")
    expect(within(dialog).getByRole("textbox", { name: "메모" })).toHaveValue("합성 부위 메모")
    expect(within(dialog).getByRole("button", { name: "발바닥 통증 4단계" })).toHaveAttribute("aria-pressed", "true")
    expect(within(dialog).getByRole("button", { name: "추가" })).toBeEnabled()
    expect(onMetadataChange).not.toHaveBeenCalled()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(dialog).toHaveAccessibleName("불편한 곳을 골라요"))
    await user.click(within(dialog).getByRole("button", { name: "기타 부위 추가" }))
    expect(within(dialog).getByRole("textbox", { name: "메모" })).toHaveValue("합성 부위 메모")
    expect(within(dialog).getByRole("button", { name: "발바닥 통증 4단계" })).toHaveAttribute("aria-pressed", "true")
    expect(onMetadataChange).not.toHaveBeenCalled()
  })

  it("discards an unapplied custom draft only when the outer dialog is closed", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    render(<BodyDiagram onMetadataChange={onMetadataChange} />)
    const dialog = await openCustomPart(user)
    await user.type(within(dialog).getByRole("textbox", { name: "부위 이름" }), "발바닥")
    await user.click(within(dialog).getByText("메모 추가"))
    await user.type(within(dialog).getByRole("textbox", { name: "메모" }), "저장하지 않은 합성 메모")
    await user.click(within(dialog).getByRole("button", { name: "발바닥 통증 3단계" }))
    await user.click(within(dialog).getByRole("button", { name: "몸 상태 입력 닫기" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(onMetadataChange).not.toHaveBeenCalled()

    const reopened = await openCustomPart(user)
    expect(within(reopened).getByRole("textbox", { name: "부위 이름" })).toHaveValue("")
    await user.click(within(reopened).getByText("메모 추가"))
    expect(within(reopened).getByRole("textbox", { name: "메모" })).toHaveValue("")
    expect(within(reopened).getAllByRole("button", { name: /통증 [1-5]단계$/u })
      .every(button => button.getAttribute("aria-pressed") === "false")).toBe(true)
    expect(within(reopened).getByRole("button", { name: "추가" })).toBeDisabled()
    expect(onMetadataChange).not.toHaveBeenCalled()
  })

  it("starts a fresh custom draft after explicit apply while preserving the applied observation", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    function ControlledBody() {
      const [metadata, setMetadata] = React.useState<BodyPartMetadataV1 | undefined>(undefined)
      return <BodyDiagram metadata={metadata} onMetadataChange={next => { onMetadataChange(next); setMetadata(next) }} />
    }
    render(<ControlledBody />)
    const dialog = await openCustomPart(user)
    await user.type(within(dialog).getByRole("textbox", { name: "부위 이름" }), "발바닥")
    await user.click(within(dialog).getByText("메모 추가"))
    await user.type(within(dialog).getByRole("textbox", { name: "메모" }), "적용할 합성 메모")
    await user.click(within(dialog).getByRole("button", { name: "발바닥 통증 3단계" }))
    await user.click(within(dialog).getByRole("button", { name: "추가" }))
    expect(onMetadataChange).toHaveBeenCalledTimes(1)
    expect(onMetadataChange.mock.calls[0]?.[0]).toMatchObject({ schemaVersion: 1,
      observations: [{ labelSnapshot: "발바닥", severity: 3, note: "적용할 합성 메모" }] })
    expect(dialog).toHaveAccessibleName("선택한 부위")
    expect(within(dialog).getByRole("button", { name: "발바닥, 통증 3/5" })).toBeVisible()
    await user.click(within(dialog).getByRole("button", { name: "다른 부위 추가" }))
    await user.click(within(dialog).getByRole("button", { name: "기타 부위 추가" }))
    expect(within(dialog).getByRole("textbox", { name: "부위 이름" })).toHaveValue("")
    await user.click(within(dialog).getByText("메모 추가"))
    expect(within(dialog).getByRole("textbox", { name: "메모" })).toHaveValue("")
    expect(within(dialog).getByRole("button", { name: "추가" })).toBeDisabled()
    expect(onMetadataChange).toHaveBeenCalledTimes(1)
  })

  it("injects and rejects a 49-character name rather than trusting the input maxLength", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    render(<BodyDiagram onMetadataChange={onMetadataChange} />)
    const dialog = await openCustomPart(user)
    const name = within(dialog).getByRole("textbox", { name: "부위 이름" })
    fireEvent.change(name, { target: { value: "a".repeat(49) } })
    await user.click(within(dialog).getByRole("button", { name: /통증 1단계$/u }))
    await user.click(within(dialog).getByRole("button", { name: "추가" }))
    expect(name).toHaveAttribute("aria-invalid", "true")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("48자까지")
    expect(onMetadataChange).not.toHaveBeenCalled()
  })

  it("injects and rejects a memo beyond the limit", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    render(<BodyDiagram onMetadataChange={onMetadataChange} />)
    const dialog = await openCustomPart(user)
    await user.type(within(dialog).getByRole("textbox", { name: "부위 이름" }), "발목 안쪽")
    await user.click(within(dialog).getByText("메모 추가"))
    const note = within(dialog).getByRole("textbox", { name: "메모" })
    fireEvent.change(note, { target: { value: "m".repeat(501) } })
    await user.click(within(dialog).getByRole("button", { name: "발목 안쪽 통증 2단계" }))
    await user.click(within(dialog).getByRole("button", { name: "추가" }))
    expect(note).toHaveAttribute("aria-invalid", "true")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("500자까지")
    expect(onMetadataChange).not.toHaveBeenCalled()
  })

  it("retains an explicit empty metadata object after clearing the last custom part", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    const metadata: BodyPartMetadataV1 = {
      schemaVersion: 1, observations: [{ id: recentId, labelSnapshot: "발목 안쪽", severity: 2, note: "임시 메모" }],
    }
    render(<BodyDiagram metadata={metadata} onMetadataChange={onMetadataChange} />)
    await user.click(screen.getByRole("button", { name: "발목 안쪽, 통증 2/5" }))
    const dialog = await screen.findByRole("dialog", { name: "기타 부위" })
    await user.click(within(dialog).getByRole("button", { name: "발목 안쪽 선택 취소" }))
    expect(onMetadataChange).toHaveBeenCalledExactlyOnceWith({ schemaVersion: 1, observations: [] })
  })

  it("keeps the custom ID and note until explicit changes are applied", async () => {
    const user = userEvent.setup()
    const onMetadataChange = vi.fn()
    const metadata: BodyPartMetadataV1 = {
      schemaVersion: 1, observations: [{ id: recentId, labelSnapshot: "발목 안쪽", severity: 2, note: "기존 메모" }],
    }
    render(<BodyDiagram metadata={metadata} onMetadataChange={onMetadataChange} />)
    await user.click(screen.getByRole("button", { name: "발목 안쪽, 통증 2/5" }))
    const dialog = await screen.findByRole("dialog", { name: "기타 부위" })
    await user.click(within(dialog).getByRole("button", { name: "발목 안쪽 통증 3단계" }))
    expect(onMetadataChange).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "변경 적용" }))
    expect(onMetadataChange).toHaveBeenCalledExactlyOnceWith({
      schemaVersion: 1, observations: [{ id: recentId, labelSnapshot: "발목 안쪽", severity: 3, note: "기존 메모" }],
    })
  })

  it("keeps part controls available when the enlarged bitmap fails to load", async () => {
    const user = userEvent.setup()
    render(<BodyDiagram />)
    const dialog = await openKnownPart(user, "무릎", "오른 무릎", "내 오른쪽 무릎")
    fireEvent.error(dialog.querySelector("img") as HTMLImageElement)
    expect(dialog.querySelector("img")).not.toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "오른 무릎 통증 4단계" })).toBeVisible()
  })

  it("keeps existing human-review guidance visible inside the open summary for high known and custom pain only", async () => {
    const user = userEvent.setup()
    function ControlledBody() {
      const [selected, setSelected] = React.useState<Record<string, number>>({})
      const [metadata, setMetadata] = React.useState<BodyPartMetadataV1 | undefined>(undefined)
      return <BodyDiagram selected={selected} onChange={setSelected}
        metadata={metadata} onMetadataChange={setMetadata} />
    }
    render(<ControlledBody />)
    const dialog = await openKnownPart(user, "무릎", "오른 무릎", "내 오른쪽 무릎")
    await user.click(within(dialog).getByRole("button", { name: "오른 무릎 통증 4단계" }))
    expect(dialog).toHaveAccessibleName("선택한 부위")
    expect(within(dialog).getByRole("status")).toHaveTextContent("지도자·보호자와 상의해 주세요.")
    expect(within(dialog).getByRole("status")).not.toHaveTextContent("계획이 보류")
    await user.click(within(dialog).getByRole("button", { name: "오른 무릎, 통증 4/5" }))
    await user.click(within(dialog).getByRole("button", { name: "오른 무릎 통증 3단계" }))
    expect(within(dialog).queryByRole("status")).toBeNull()

    await user.click(within(dialog).getByRole("button", { name: "다른 부위 추가" }))
    await user.click(within(dialog).getByRole("button", { name: "기타 부위 추가" }))
    await user.type(within(dialog).getByRole("textbox", { name: "부위 이름" }), "발목 안쪽")
    await user.click(within(dialog).getByRole("button", { name: "발목 안쪽 통증 5단계" }))
    await user.click(within(dialog).getByRole("button", { name: "추가" }))
    expect(screen.getByRole("dialog", { name: "선택한 부위" })).toBe(dialog)
    expect(within(dialog).getByRole("status")).toHaveTextContent("지도자·보호자와 상의해 주세요.")
    await user.click(within(dialog).getByRole("button", { name: "발목 안쪽, 통증 5/5" }))
    await user.click(within(dialog).getByRole("button", { name: "발목 안쪽 통증 2단계" }))
    await user.click(within(dialog).getByRole("button", { name: "변경 적용" }))
    expect(dialog).toHaveAccessibleName("선택한 부위")
    expect(within(dialog).queryByRole("status")).toBeNull()
  })

  it("focuses the custom name and an existing known level without the dialog title stealing focus", async () => {
    const user = userEvent.setup()
    render(<BodyDiagram selected={{ rKnee: 2 }} onChange={vi.fn()} onMetadataChange={vi.fn()} />)
    const customDialog = await openCustomPart(user)
    const name = within(customDialog).getByRole("textbox", { name: "부위 이름" })
    await waitFor(() => expect(document.activeElement).toBe(name))
    await user.click(within(customDialog).getByRole("button", { name: "몸 상태 입력 닫기" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: "오른 무릎, 통증 2/5" }))
    const knownDialog = await screen.findByRole("dialog", { name: "내 오른쪽 무릎" })
    const currentLevel = within(knownDialog).getByRole("button", { name: "오른 무릎 통증 2단계" })
    expect(currentLevel).toHaveAttribute("aria-pressed", "true")
    await waitFor(() => expect(document.activeElement).toBe(currentLevel))
  })

  it.each(["Escape", "browser Back"] as const)("closes only inline high-pain help with %s and restores its trigger", async (action) => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    function ControlledBody() {
      const [selected, setSelected] = React.useState<Record<string, number>>({})
      return <BodyDiagram selected={selected} onChange={next => { onChange(next); setSelected(next) }} />
    }
    render(<ControlledBody />)
    const dialog = await openKnownPart(user, "무릎", "오른 무릎", "내 오른쪽 무릎")
    await user.click(within(dialog).getByRole("button", { name: "오른 무릎 통증 4단계" }))
    expect(dialog).toHaveAccessibleName("선택한 부위")
    const help = within(dialog).getByRole("button", { name: "왜 확인하나요?" })
    await user.click(help)
    expect(help).toHaveAttribute("aria-expanded", "true")
    const detailId = help.getAttribute("aria-controls")
    expect(detailId).toBeTruthy()
    expect(document.getElementById(detailId!)).toBeVisible()
    expect(screen.getAllByRole("dialog")).toEqual([dialog])

    if (action === "Escape") await user.keyboard("{Escape}")
    else await act(async () => { window.history.back() })
    await waitFor(() => expect(help).toHaveAttribute("aria-expanded", "false"))
    expect(document.getElementById(detailId!)).toBeNull()
    expect(screen.getByRole("dialog", { name: "선택한 부위" })).toBe(dialog)
    await waitFor(() => expect(help).toHaveFocus())
    expect(within(dialog).getByRole("button", { name: "오른 무릎, 통증 4/5" })).toBeVisible()
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ rKnee: 4 })
    await user.click(within(dialog).getByRole("button", { name: "입력 완료" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("clears open high-pain help before editing a selected part so one Escape reaches the picker", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    function ControlledBody() {
      const [selected, setSelected] = React.useState<Record<string, number>>({})
      return <BodyDiagram selected={selected} onChange={next => { onChange(next); setSelected(next) }} />
    }
    render(<ControlledBody />)
    const dialog = await openKnownPart(user, "무릎", "오른 무릎", "내 오른쪽 무릎")
    await user.click(within(dialog).getByRole("button", { name: "오른 무릎 통증 4단계" }))
    const help = within(dialog).getByRole("button", { name: "왜 확인하나요?" })
    await user.click(help)
    expect(help).toHaveAttribute("aria-expanded", "true")
    const detailId = help.getAttribute("aria-controls")
    expect(detailId).toBeTruthy()
    expect(document.getElementById(detailId!)).toBeVisible()

    await user.click(within(dialog).getByRole("button", { name: "오른 무릎, 통증 4/5" }))
    expect(dialog).toHaveAccessibleName("내 오른쪽 무릎")
    expect(document.getElementById(detailId!)).toBeNull()
    expect(within(dialog).getByRole("button", { name: "오른 무릎 통증 4단계" }))
      .toHaveAttribute("aria-pressed", "true")
    await user.keyboard("{Escape}")
    await waitFor(() => expect(dialog).toHaveAccessibleName("불편한 곳을 골라요"))
    expect(screen.getAllByRole("dialog")).toEqual([dialog])
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ rKnee: 4 })
  })
})
