import React from "react"
import {
  OBJECTIVE_COMPONENT_KIND,
  objectiveLoadComponentSchema,
} from "../../domain/intensity-assessment"
import type { ObjectiveLoadComponent } from "../../domain/intensity-assessment"
import { parseDecimalString, parsePaceText } from "../../domain/numeric-input"
import { inputStyle } from "./input-style"

type ComponentKind = ObjectiveLoadComponent["kind"]
type DraftFields = Readonly<Record<string, string>>
type FieldSpec = {
  readonly key: string
  readonly label: string
  readonly placeholder?: string
  readonly type?: "number" | "text"
}

type ComponentBuildResult =
  | { readonly success: true; readonly component: ObjectiveLoadComponent }
  | { readonly success: false; readonly invalidKeys: readonly string[] }

const KIND_LABELS: Readonly<Record<ComponentKind, string>> = {
  RUNNING: "달리기",
  INTERVALS: "인터벌",
  STRENGTH: "근력",
  PLYOMETRIC: "플라이오",
  HILLS: "언덕",
  CROSS_TRAINING: "대체유산소",
}

const FIELDS: Readonly<Record<ComponentKind, readonly FieldSpec[]>> = {
  RUNNING: [
    { key: "distanceKm", label: "거리 (km)", type: "number" },
    { key: "actualPace", label: "실제 페이스 (/km)", placeholder: "3:30" },
    { key: "typicalDistanceKm", label: "평소 거리 (km) · 선택", type: "number" },
    { key: "referencePace", label: "개인 기준 페이스 · 선택", placeholder: "3:20" },
  ],
  INTERVALS: [
    { key: "repetitions", label: "반복 횟수", type: "number" },
    { key: "workSeconds", label: "운동 시간 (초)", type: "number" },
    { key: "recoverySeconds", label: "회복 시간 (초)", type: "number" },
    { key: "actualPace", label: "반복 페이스 · 선택", placeholder: "3:00" },
    { key: "referencePace", label: "개인 기준 페이스 · 선택", placeholder: "3:10" },
  ],
  STRENGTH: [
    { key: "exerciseType", label: "운동 종류", placeholder: "스쿼트" },
    { key: "sets", label: "세트", type: "number" },
    { key: "repetitions", label: "세트당 반복", type: "number" },
    { key: "loadPercent1Rm", label: "강도 (%1RM) · 선택", type: "number" },
    { key: "repsInReserve", label: "남은 반복 (RIR) · 선택", type: "number" },
  ],
  PLYOMETRIC: [
    { key: "exerciseType", label: "운동 종류", placeholder: "바운딩" },
    { key: "contacts", label: "접지 수", type: "number" },
    { key: "typicalContacts", label: "평소 접지 수 · 선택", type: "number" },
  ],
  HILLS: [
    { key: "repetitions", label: "반복 횟수", type: "number" },
    { key: "workSeconds", label: "운동 시간 (초)", type: "number" },
    { key: "recoverySeconds", label: "회복 시간 (초)", type: "number" },
    { key: "gradePercent", label: "경사 (%) · 선택", type: "number" },
  ],
  CROSS_TRAINING: [
    { key: "modality", label: "운동 종류", placeholder: "자전거" },
    { key: "durationMin", label: "시간 (분)", type: "number" },
    { key: "heartRatePercent", label: "평균 심박 (%HRmax) · 선택", type: "number" },
  ],
}

const FIELD_KEY_BY_SCHEMA_PATH: Readonly<Record<string, string>> = {
  distanceKm: "distanceKm",
  actualPaceSecondsPerKm: "actualPace",
  typicalDistanceKm: "typicalDistanceKm",
  referencePaceSecondsPerKm: "referencePace",
  repetitions: "repetitions",
  workSeconds: "workSeconds",
  recoverySeconds: "recoverySeconds",
  exerciseType: "exerciseType",
  sets: "sets",
  loadPercent1Rm: "loadPercent1Rm",
  repsInReserve: "repsInReserve",
  contacts: "contacts",
  typicalContacts: "typicalContacts",
  gradePercent: "gradePercent",
  modality: "modality",
  durationMin: "durationMin",
  averageHeartRatePercentMax: "heartRatePercent",
}

function optionalNumber(fields: DraftFields, key: string): number | null | undefined {
  const value = fields[key]?.trim() ?? ""
  return value === "" ? undefined : parseDecimalString(value)
}

function parseComponentKind(value: string): ComponentKind {
  switch (value) {
    case "RUNNING":
    case "INTERVALS":
    case "STRENGTH":
    case "PLYOMETRIC":
    case "HILLS":
    case "CROSS_TRAINING":
      return value
    default:
      return OBJECTIVE_COMPONENT_KIND.intervals
  }
}

function buildComponent(kind: ComponentKind, fields: DraftFields): ComponentBuildResult {
  const n = (key: string) => parseDecimalString(fields[key] ?? "")
  const pace = (key: string): number | null | undefined => {
    const value = fields[key]?.trim() ?? ""
    return value === "" ? undefined : parsePaceText(value)
  }
  const componentId = globalThis.crypto.randomUUID()
  let candidate: unknown

  switch (kind) {
    case "RUNNING":
      candidate = {
        componentId, kind, distanceKm: n("distanceKm"), actualPaceSecondsPerKm: pace("actualPace"),
        ...(optionalNumber(fields, "typicalDistanceKm") === undefined ? {} : { typicalDistanceKm: optionalNumber(fields, "typicalDistanceKm") }),
        ...(pace("referencePace") === undefined ? {} : { referencePaceSecondsPerKm: pace("referencePace") }),
      }
      break
    case "INTERVALS":
      candidate = {
        componentId, kind, repetitions: n("repetitions"), workSeconds: n("workSeconds"), recoverySeconds: n("recoverySeconds"),
        ...(pace("actualPace") === undefined ? {} : { actualPaceSecondsPerKm: pace("actualPace") }),
        ...(pace("referencePace") === undefined ? {} : { referencePaceSecondsPerKm: pace("referencePace") }),
      }
      break
    case "STRENGTH":
      candidate = {
        componentId, kind, exerciseType: fields["exerciseType"]?.trim() ?? "", sets: n("sets"), repetitions: n("repetitions"),
        ...(optionalNumber(fields, "loadPercent1Rm") === undefined ? {} : { loadPercent1Rm: optionalNumber(fields, "loadPercent1Rm") }),
        ...(optionalNumber(fields, "repsInReserve") === undefined ? {} : { repsInReserve: optionalNumber(fields, "repsInReserve") }),
      }
      break
    case "PLYOMETRIC":
      candidate = {
        componentId, kind, exerciseType: fields["exerciseType"]?.trim() ?? "", contacts: n("contacts"),
        ...(optionalNumber(fields, "typicalContacts") === undefined ? {} : { typicalContacts: optionalNumber(fields, "typicalContacts") }),
      }
      break
    case "HILLS":
      candidate = {
        componentId, kind, repetitions: n("repetitions"), workSeconds: n("workSeconds"), recoverySeconds: n("recoverySeconds"),
        ...(optionalNumber(fields, "gradePercent") === undefined ? {} : { gradePercent: optionalNumber(fields, "gradePercent") }),
      }
      break
    case "CROSS_TRAINING":
      candidate = {
        componentId, kind, modality: fields["modality"]?.trim() ?? "", durationMin: n("durationMin"),
        ...(optionalNumber(fields, "heartRatePercent") === undefined ? {} : { averageHeartRatePercentMax: optionalNumber(fields, "heartRatePercent") }),
      }
      break
  }

  const parsed = objectiveLoadComponentSchema.safeParse(candidate)
  if (parsed.success) return { success: true, component: parsed.data }

  const invalidKeys = parsed.error.issues.flatMap((issue) => {
    if (issue.code !== "invalid_union") {
      const fieldKey = FIELD_KEY_BY_SCHEMA_PATH[String(issue.path[0] ?? "")]
      return fieldKey === undefined ? [] : [fieldKey]
    }
    const matchingBranch = issue.errors.find((errors) => (
      errors.every((nestedIssue) => nestedIssue.path[0] !== "kind")
    ))
    return (matchingBranch ?? []).flatMap((nestedIssue) => {
      const fieldKey = FIELD_KEY_BY_SCHEMA_PATH[String(nestedIssue.path[0] ?? "")]
      return fieldKey === undefined ? [] : [fieldKey]
    })
  })
  return { success: false, invalidKeys: [...new Set(invalidKeys)] }
}

export function ObjectiveComponentEditor({
  disabled,
  onAdd,
}: {
  readonly disabled: boolean
  readonly onAdd: (component: ObjectiveLoadComponent) => void
}) {
  const [kind, setKind] = React.useState<ComponentKind>(OBJECTIVE_COMPONENT_KIND.intervals)
  const [fields, setFields] = React.useState<Record<string, string>>({})
  const [invalidKeys, setInvalidKeys] = React.useState<readonly string[] | null>(null)
  const add = () => {
    const result = buildComponent(kind, fields)
    if (!result.success) { setInvalidKeys(result.invalidKeys); return }
    onAdd(result.component)
    setFields({})
    setInvalidKeys(null)
  }
  const invalidLabels = FIELDS[kind]
    .filter((field) => invalidKeys?.includes(field.key) ?? false)
    .map((field) => field.label)

  return (
    <div style={{ border: "1px solid var(--line)", padding: 12, background: "var(--surface)" }}>
      <select aria-label="객관 기록 종류" value={kind} onChange={(event) => {
        setKind(parseComponentKind(event.target.value))
        setFields({})
        setInvalidKeys(null)
      }} style={inputStyle()}>
        {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(136px, 1fr))", gap: 8, marginTop: 8 }}>
        {FIELDS[kind].map((field) => (
          <label key={field.key} style={{ minWidth: 0, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)" }}>
            <span style={{ display: "block", minHeight: 24, lineHeight: 1.3 }}>{field.label}</span>
            <input
              aria-label={field.label}
              type={field.type ?? "text"}
              min={field.type === "number" ? "0" : undefined}
              step="any"
              inputMode={field.type === "number" ? "decimal" : "text"}
              placeholder={field.placeholder}
              value={fields[field.key] ?? ""}
              aria-invalid={invalidKeys?.includes(field.key) ?? false}
              onChange={(event) => {
                setFields((current) => ({ ...current, [field.key]: event.target.value }))
                setInvalidKeys((current) => {
                  const remaining = current?.filter((key) => key !== field.key) ?? []
                  return remaining.length > 0 ? remaining : null
                })
              }}
              style={{ ...inputStyle(), fontFamily: "var(--mono)" }}
            />
          </label>
        ))}
      </div>
      {invalidKeys !== null && <div role="alert" style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 10, color: "var(--pain-5)" }}>
        {invalidLabels.length > 0 ? `다시 확인: ${invalidLabels.join(", ")}` : "필수 숫자와 범위를 확인해 주세요."}
      </div>}
      <button type="button" disabled={disabled} onClick={add} style={{
        width: "100%", minHeight: 44, marginTop: 10, border: "1px solid var(--ink)",
        background: disabled ? "var(--hair)" : "var(--ink)", color: disabled ? "var(--ink-3)" : "var(--bg)",
        fontFamily: "var(--sans)", fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
      }}>객관 구성 추가</button>
    </div>
  )
}
