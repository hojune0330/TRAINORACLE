import React from "react"
import {
  OBJECTIVE_COMPONENT_KIND,
  objectiveLoadComponentSchema,
} from "../../domain/intensity-assessment"
import type { ObjectiveLoadComponent } from "../../domain/intensity-assessment"
import { parseDecimalString, parsePaceText } from "../../domain/numeric-input"
import { inputStyle } from "./shared"

type ComponentKind = ObjectiveLoadComponent["kind"]
type DraftFields = Readonly<Record<string, string>>
type FieldSpec = {
  readonly key: string
  readonly label: string
  readonly placeholder?: string
  readonly type?: "number" | "text"
}

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

function buildComponent(kind: ComponentKind, fields: DraftFields): ObjectiveLoadComponent | null {
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
  return parsed.success ? parsed.data : null
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
  const [error, setError] = React.useState(false)
  const add = () => {
    const component = buildComponent(kind, fields)
    if (component === null) { setError(true); return }
    onAdd(component)
    setFields({})
    setError(false)
  }

  return (
    <div style={{ border: "1px solid var(--line)", padding: 12, background: "var(--surface)" }}>
      <select aria-label="객관 기록 종류" value={kind} onChange={(event) => {
        setKind(parseComponentKind(event.target.value))
        setFields({})
        setError(false)
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
              onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
              style={{ ...inputStyle(), fontFamily: "var(--mono)" }}
            />
          </label>
        ))}
      </div>
      {error && <div role="alert" style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 10, color: "var(--pain-5)" }}>필수 숫자와 범위를 확인해 주세요.</div>}
      <button type="button" disabled={disabled} onClick={add} style={{
        width: "100%", minHeight: 44, marginTop: 10, border: "1px solid var(--ink)",
        background: disabled ? "var(--hair)" : "var(--ink)", color: disabled ? "var(--ink-3)" : "var(--bg)",
        fontFamily: "var(--sans)", fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
      }}>객관 구성 추가</button>
    </div>
  )
}
