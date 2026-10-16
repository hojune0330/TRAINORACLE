import { MoodStrip } from "../../components/JournalPrimitives"
import { inputStyle } from "./input-style"
import { FormSec } from "./shared"
import { JournalNumberScale } from "./JournalNumberScale"

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
          <div role="alert" style={{ marginTop: "var(--space-2)", fontFamily: "var(--sans)", fontSize: "var(--fs-body-sm)", lineHeight: 1.5, color: "var(--pain-5)" }}>
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
  return <JournalNumberScale label={label} length={length} selected={selected}
    onSelect={value => onSelect(selected === value ? null : value)} />
}

function MoodToggleScale({ label, selected, onSelect }: Omit<ToggleScaleProps, "length">) {
  return (
    <div role="group" aria-label={label} className="journal-mood-scale app-choice-group">
      {MOOD_LABELS.map((moodLabel, index) => {
        const value = index + 1
        return (
          <button
            key={moodLabel}
            type="button"
            className="app-choice-control journal-mood-scale__option"
            aria-label={`${label} ${value}`}
            aria-pressed={selected === value}
            onClick={() => onSelect(selected === value ? null : value)}
          >
            <MoodStrip level={value} />
            <span>{moodLabel}</span>
          </button>
        )
      })}
    </div>
  )
}

const unitStyle = {
  fontFamily: "var(--mono)",
  fontSize: "var(--fs-body-sm)",
  color: "var(--ink-3)",
  whiteSpace: "nowrap",
} as const
