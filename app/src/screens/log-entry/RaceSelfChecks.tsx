import { MoodStrip } from "../../components/JournalPrimitives"
import { FormSec, inputStyle } from "./shared"

const MOOD_LABELS = ["흐림", "무덤덤", "보통", "좋음", "최고"] as const

type ToggleScaleProps = {
  readonly label: string
  readonly length: number
  readonly selected: number | null
  readonly onSelect: (value: number | null) => void
}

export function RacePreChecks({
  tension,
  condition,
  paceMinutes,
  paceSeconds,
  paceError,
  onTension,
  onCondition,
  onPaceMinutes,
  onPaceSeconds,
}: {
  readonly tension: number | null
  readonly condition: number | null
  readonly paceMinutes: string
  readonly paceSeconds: string
  readonly paceError: string | null
  readonly onTension: (value: number | null) => void
  readonly onCondition: (value: number | null) => void
  readonly onPaceMinutes: (value: string) => void
  readonly onPaceSeconds: (value: string) => void
}) {
  return (
    <>
      <FormSec lb="긴장도 · 선택 사항">
        <NumberToggleScale label="긴장도" length={10} selected={tension} onSelect={onTension} />
      </FormSec>
      <FormSec lb="컨디션 · 선택 사항">
        <MoodToggleScale label="컨디션" selected={condition} onSelect={onCondition} />
      </FormSec>
      <FormSec lb="목표 페이스 · 선택 사항" help="pace">
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto", gap: 7, alignItems: "center" }}>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            aria-label="목표 페이스 분"
            value={paceMinutes}
            onChange={(event) => onPaceMinutes(event.target.value)}
            style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }}
          />
          <span style={unitStyle}>분</span>
          <input
            type="number"
            min="0"
            max="59"
            inputMode="numeric"
            aria-label="목표 페이스 초"
            value={paceSeconds}
            onChange={(event) => onPaceSeconds(event.target.value)}
            style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }}
          />
          <span style={unitStyle}>초/km</span>
        </div>
        {paceError !== null && (
          <div role="alert" style={{ marginTop: 7, fontFamily: "var(--mono)", fontSize: 10, color: "var(--pain-5)" }}>
            {paceError}
          </div>
        )}
      </FormSec>
    </>
  )
}

export function RacePostMood({ selected, onSelect }: {
  readonly selected: number | null
  readonly onSelect: (value: number | null) => void
}) {
  return (
    <FormSec lb="감정 · 선택 사항">
      <MoodToggleScale label="감정" selected={selected} onSelect={onSelect} />
    </FormSec>
  )
}

function NumberToggleScale({ label, length, selected, onSelect }: ToggleScaleProps) {
  return (
    <div role="group" aria-label={label} style={{ display: "grid", gridTemplateColumns: `repeat(${length}, 1fr)`, border: "1px solid var(--ink)" }}>
      {Array.from({ length }, (_, index) => index + 1).map((value) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} ${value}`}
          aria-pressed={selected === value}
          onClick={() => onSelect(selected === value ? null : value)}
          style={{
            minWidth: 0, padding: "12px 0", border: 0,
            background: selected === value ? "var(--ink-blue)" : "transparent",
            color: selected === value ? "#fff" : "var(--ink)",
            borderRight: value < length ? "1px solid var(--line)" : 0,
            fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer",
          }}
        >{value}</button>
      ))}
    </div>
  )
}

function MoodToggleScale({ label, selected, onSelect }: Omit<ToggleScaleProps, "length">) {
  return (
    <div role="group" aria-label={label} style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
      {MOOD_LABELS.map((moodLabel, index) => {
        const value = index + 1
        return (
          <button
            key={moodLabel}
            type="button"
            aria-label={`${label} ${value}`}
            aria-pressed={selected === value}
            onClick={() => onSelect(selected === value ? null : value)}
            style={{
              minWidth: 0, padding: "14px 2px 10px",
              background: selected === value ? "var(--surface)" : "transparent",
              border: selected === value ? "1px solid var(--ink)" : "1px solid var(--line)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              cursor: "pointer", borderRadius: 0,
            }}
          >
            <MoodStrip level={value} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)" }}>{moodLabel}</span>
          </button>
        )
      })}
    </div>
  )
}

const unitStyle = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  color: "var(--ink-3)",
  whiteSpace: "nowrap",
} as const
