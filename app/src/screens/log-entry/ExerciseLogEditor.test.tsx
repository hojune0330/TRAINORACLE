import React from "react"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ExerciseLogEditor } from "./ExerciseLogEditor"
import { exerciseEditorDraftSchema, type ExerciseEditorDraft } from "./form-input-draft"
import type { ExerciseLog } from "../../domain/exercise-log"

function Harness() {
  const [value, setValue] = React.useState<ExerciseLog>({ version: 1, source: "SELF_REPORTED", components: [] })
  const [draft, setDraft] = React.useState<ExerciseEditorDraft>()
  return <><ExerciseLogEditor value={value} onChange={setValue} draft={draft} onDraftChange={setDraft} /><output data-testid="value">{JSON.stringify(value)}</output><output data-testid="draft">{JSON.stringify(draft ?? null)}</output></>
}
const read = () => JSON.parse(screen.getByTestId("value").textContent!) as ExerciseLog
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }))
const fill = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } })
afterEach(cleanup)

describe("optional exercise editor", () => {
  it("keeps partial fields across category changes and an input-draft roundtrip", () => {
    render(<Harness />)
    click("운동 추가"); click("반복 달리기"); click("거리·시간·횟수 적기")
    fill("1번 거리 (m)", "400"); fill("1번 반복 횟수", "10")
    click("근력 운동"); click("거리·시간·횟수 적기"); fill("1번 중량 (kg)", "60")
    click("반복 달리기")
    expect(screen.getByLabelText("1번 거리 (m)")).toHaveValue("400")
    expect(screen.getByLabelText("1번 반복 횟수")).toHaveValue("10")
    const draft = exerciseEditorDraftSchema.parse(JSON.parse(screen.getByTestId("draft").textContent!))
    expect(draft.previousKinds?.STRENGTH?.rows[0]?.loadKg).toBe("60")
    click("접기 · 입력 유지"); click("작성하던 운동 계속")
    expect(screen.getByLabelText("1번 거리 (m)")).toHaveValue("400")
  })
  it("rejects malformed values without dropping them, and restores a deleted row", () => {
    render(<Harness />)
    click("운동 추가"); click("반복 달리기"); click("거리·시간·횟수 적기")
    fill("1번 반복 횟수", "1.5"); click("내용 반영")
    expect(screen.getByRole("alert")).toBeVisible()
    expect(read().components).toHaveLength(0)
    expect(screen.getByLabelText("1번 반복 횟수")).toHaveValue("1.5")
    fill("1번 반복 횟수", "12")
    click("1번 구간 삭제"); click("구간 삭제 취소")
    expect(screen.getByLabelText("1번 반복 횟수")).toHaveValue("12")
    click("내용 반영")
    expect(read().components[0]?.rows[0]?.repetitions).toBe(12)
  })
  it("duplicates with fresh IDs, reorders, edits and undoes deletion", () => {
    render(<Harness />)
    click("운동 추가"); fill("운동 이름", "조깅"); click("내용 반영")
    click("운동 1 복제")
    const original = read().components[0]!.id
    const duplicate = read().components[1]!.id
    expect(duplicate).not.toBe(original)
    click("운동 2 앞으로")
    expect(read().components[0]?.id).toBe(duplicate)
    click("운동 1 수정"); fill("운동 이름", "수정된 운동"); click("내용 반영")
    expect(read().components[0]?.id).toBe(duplicate)
    click("운동 1 삭제"); click("삭제 취소")
    expect(read().components[0]).toMatchObject({ id: duplicate, name: "수정된 운동" })
  })
  it("does not let deletion discard the exercise currently being edited", () => {
    render(<Harness />)
    click("운동 추가"); fill("운동 이름", "조깅"); click("내용 반영")
    click("운동 1 수정"); fill("운동 이름", "수정 중")
    expect(screen.getByRole("button", { name: "운동 1 삭제" })).toBeDisabled()
    click("접기 · 입력 유지"); click("작성하던 운동 계속")
    expect(screen.getByLabelText("운동 이름")).toHaveValue("수정 중")
  })
})
