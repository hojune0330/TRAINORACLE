import React from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { z } from "zod"
import { FormDraftPreview, formatFormDraftValue, formatFormInputValue } from "./FormInputConflictPanel"
import { formInputSchema, objectiveEditorDraftSchema, type FormDraftBody, type FormInput } from "./form-input-draft"
import { JOURNAL_ENERGY_SYSTEM_OPTIONS } from "../../domain/energy-system-taxonomy"

afterEach(cleanup)

it("distinguishes schema sentinels from valid numeric zero and explicit Quick skipping", () => {
  const evening: FormInput = { kind: "evening", sleep: 0, quality: 0, mood: 0, painParts: {}, weight: "0", hr: "", memo: "", purpose: null }
  expect(formatFormInputValue(evening, "sleep", 0)).toBe("0")
  expect(formatFormInputValue(evening, "weight", "0")).toBe("0")
  expect(formatFormInputValue(evening, "quality", 0)).toBe("미입력")
  expect(formatFormInputValue(evening, "mood", 0)).toBe("미입력")
  const quick: FormInput = { kind: "quick", step: "effort", outcome: "COMPLETED", slot: null, rpe: 0,
    effortAnswered: false, painStatus: "UNANSWERED", painParts: {} }
  expect(formatFormInputValue(quick, "rpe", 0)).toBe("미입력")
  expect(formatFormInputValue({ ...quick, effortAnswered: true }, "rpe", 0)).toBe("건너뜀")
  expect(formatFormInputValue({ ...quick, effortAnswered: true, rpe: 3 }, "rpe", 3)).toBe("3")
  const detailed = formInputSchema.parse({ kind: "post-session", rpe: 0, plannedRpe: 0, activityOutcome: null, activitySlot: null,
    painCheckStatus: "UNANSWERED", painParts: {}, system: "", title: "", distanceKm: "", durationMin: "", avgPace: "", memo: "", purpose: null,
    objectiveComponents: [], objectiveEditor: { kind: "INTERVALS", fields: {} } })
  expect(formatFormInputValue(detailed, "rpe", 0)).toBe("미입력")
  expect(formatFormInputValue(detailed, "plannedRpe", 0)).toBe("미입력")
  expect(formatFormDraftValue("repsInReserve", 0)).toBe("0")
  const race = formInputSchema.parse({ kind: "race", stage: "pre", record: "", rank: "", result: "", tension: 0,
    condition: null, mood: null, paceMinutes: "0", paceSeconds: "", memo: "", purpose: null })
  expect(formatFormInputValue(race, "tension", 0)).toBe("0")
  expect(formatFormInputValue(race, "condition", null)).toBe("미입력")
})

it.each<FormInput>([
  { kind: "evening", sleep: 8, quality: 3, mood: 3, painParts: {}, weight: "62.", hr: "", memo: "합성 메모", purpose: null },
  { kind: "race", stage: "pre", record: "16:", rank: "", result: "", tension: null, condition: null, mood: null,
    paceMinutes: "03", paceSeconds: "", memo: "합성 메모", purpose: null },
  { kind: "quick", step: "effort", outcome: "PARTIAL", slot: "AM", rpe: 0, effortAnswered: true, painStatus: "UNANSWERED", painParts: {} },
])("labels every field in the $kind preview without raw keys", input => {
  const body: FormDraftBody = { format: "TRAINORACLE_FORM_INPUT_V1", context: "synthetic", entryId: "synthetic",
    baseSavedAt: null, completed: false, input: formInputSchema.parse(input) }
  const { container } = render(<FormDraftPreview body={body} />)
  for (const key of Object.keys(input)) expect(container.textContent).not.toContain(key)
  expect(container.textContent).not.toContain("추가 항목")
})

it("labels every enum in all four input schemas, including objective kinds", () => {
  const shapes = [...formInputSchema.options.map(option => option.shape), objectiveEditorDraftSchema.shape]
  for (const shape of shapes) for (const [key, schema] of Object.entries(shape)) {
    if (key === "kind" && !(schema instanceof z.ZodEnum)) continue
    const value = schema instanceof z.ZodNullable ? schema.unwrap() : schema
    if (value instanceof z.ZodEnum) for (const option of value.options) {
      const label = formatFormDraftValue(key, option)
      expect(label).not.toBe(option)
      expect(label).not.toBe("분류 확인 필요")
    }
  }
  for (const option of JOURNAL_ENERGY_SYSTEM_OPTIONS) for (const value of [option.key, option.journalValue, option.code]) {
    expect(formatFormDraftValue("system", value)).toBe(option.shortLabel)
  }
})

it("uses answered labels only for the actual answer flag and leaves free text unchanged", () => {
  expect(formatFormDraftValue("effortAnswered", true)).toBe("응답함")
  expect(formatFormDraftValue("effortAnswered", false)).toBe("미응답")
  expect(formatFormDraftValue("enabled", true)).toBe("예")
  expect(formatFormDraftValue("enabled", false)).toBe("아니요")
  for (const key of ["memo", "title", "exerciseType", "modality", "record"]) {
    expect(formatFormDraftValue(key, "AM")).toBe("AM")
    expect(formatFormDraftValue(key, "ATP_PC")).toBe("ATP_PC")
  }
  expect(formatFormDraftValue("system", "unknown_legacy_value")).toBe("기존 강도 분류 · 확인 필요")
})

it("labels all objective input and stored component fields without leaking field keys or IDs", () => {
  const fields = Object.fromEntries(Object.keys(objectiveEditorDraftSchema.shape.fields.shape).map(key => [key, "12"]))
  const components = [
    { kind: "RUNNING", distanceKm: 5, actualPaceSecondsPerKm: 200, typicalDistanceKm: 6, referencePaceSecondsPerKm: 210 },
    { kind: "INTERVALS", repetitions: 6, workSeconds: 60, recoverySeconds: 90, actualPaceSecondsPerKm: 200, referencePaceSecondsPerKm: 210 },
    { kind: "STRENGTH", exerciseType: "합성 운동", sets: 3, repetitions: 8, loadPercent1Rm: 70, repsInReserve: 2 },
    { kind: "PLYOMETRIC", exerciseType: "합성 운동", contacts: 30, typicalContacts: 40 },
    { kind: "HILLS", repetitions: 6, workSeconds: 30, recoverySeconds: 60, gradePercent: 5 },
    { kind: "CROSS_TRAINING", modality: "합성 운동", durationMin: 30, averageHeartRatePercentMax: 70 },
  ].map((component, index) => ({ componentId: `synthetic-component-${index}`, ...component }))
  const input = formInputSchema.parse({ kind: "post-session", rpe: 3, activityOutcome: "PARTIAL", activitySlot: "AM",
    painCheckStatus: "SIGNAL_REPORTED", painParts: { rKnee: 2, lKnee: 1, rCalf: 1, lCalf: 1, rHam: 1, lHam: 1, lBack: 1, rFoot: 1, lFoot: 1, rShin: 1 },
    system: "atp", title: "합성 세션", distanceKm: "", durationMin: "", avgPace: "", plannedRpe: 3,
    objectiveComponents: components, objectiveEditor: { kind: "INTERVALS", fields }, memo: "합성 메모", purpose: null })
  const body: FormDraftBody = { format: "TRAINORACLE_FORM_INPUT_V1", context: "synthetic", entryId: "synthetic",
    baseSavedAt: null, completed: false, input }
  const { container } = render(<FormDraftPreview body={body} />)
  const text = container.textContent!
  const keys = [...Object.keys(input), ...Object.keys(fields), ...components.flatMap(Object.keys), ...Object.keys(input.kind === "post-session" ? input.painParts : {})]
  for (const key of keys) expect(text).not.toContain(key)
  for (const component of components) { expect(text).not.toContain(component.kind); expect(text).not.toContain(component.componentId) }
  expect(text).not.toContain("추가 항목")
  expect(text).toContain("스피드·가속")
  expect(text).toContain("오른 무릎: 2")
  expect(text).toContain("인터벌")
  expect(text).toContain("최대 심박 대비 평균 심박 (%)")
})
