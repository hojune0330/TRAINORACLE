import { useId, useRef, useState } from "react"
import type { FormEvent } from "react"
import type { InstantPlanEntry } from "../../domain/instant-plan-contract"
import "./instant-plan.css"

export type InstantPlanEntryFormProps = {
  readonly onSubmit: (entry: InstantPlanEntry) => void
  /** The integrating screen supplies its local calendar date, YYYY-MM-DD. */
  readonly today: string
  /** Initial values only. Remount for a different person's or program's entry. */
  readonly initialEntry?: InstantPlanEntry
  readonly disabled?: boolean
  readonly sourceLabel?: string
}

const EVENTS: readonly { value: InstantPlanEntry["eventDistanceM"]; label: string }[] = [
  { value: 800, label: "800m" },
  { value: 1500, label: "1500m" },
  { value: 3000, label: "3000m" },
  { value: 5000, label: "5km" },
  { value: 10000, label: "10km" },
  { value: 21097, label: "하프 마라톤" },
  { value: 42195, label: "마라톤" },
]

type Field = "event" | "minutes" | "seconds" | "achievedOn"
type Errors = Partial<Record<Field, string>>

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= (days[month - 1] ?? 0)
}

function decimalText(value: number): string {
  const [coefficient = "", exponentText] = String(value).split("e")
  if (exponentText === undefined) return coefficient
  const [whole = "", fraction = ""] = coefficient.split(".")
  const digits = whole + fraction
  const point = whole.length + Number(exponentText)
  if (point <= 0) return `0.${"0".repeat(-point)}${digits}`
  if (point >= digits.length) return digits + "0".repeat(point - digits.length)
  return `${digits.slice(0, point)}.${digits.slice(point)}`
}

function initialTime(entry?: InstantPlanEntry): { minutes: string; seconds: string } {
  if (!entry || entry.kind === "NO_RECORD") return { minutes: "", seconds: "" }
  const total = entry.performanceSeconds
  if (!Number.isFinite(total) || total <= 0) return { minutes: "", seconds: "" }
  const minutes = Math.floor(total / 60)
  // Decimal text avoids showing the binary remainder (e.g. 30.120000000000005).
  const [whole = "", fraction = ""] = decimalText(total).split(".")
  const seconds = `${Number(whole) % 60}${fraction ? `.${fraction}` : ""}`
  return { minutes: decimalText(minutes), seconds }
}

/** Collects facts only. Eligibility, safety, generation and storage belong to the caller. */
export function InstantPlanEntryForm({
  onSubmit, today, initialEntry, disabled = false, sourceLabel,
}: InstantPlanEntryFormProps) {
  const id = useId()
  const [kind, setKind] = useState<InstantPlanEntry["kind"]>(initialEntry?.kind ?? "CURRENT_RECORD")
  const [event, setEvent] = useState(initialEntry ? String(initialEntry.eventDistanceM) : "")
  const [minutes, setMinutes] = useState(() => initialTime(initialEntry).minutes)
  const [seconds, setSeconds] = useState(() => initialTime(initialEntry).seconds)
  const [achievedOn, setAchievedOn] = useState(initialEntry?.kind === "CURRENT_RECORD" ? initialEntry.achievedOn : "")
  const [errors, setErrors] = useState<Errors>({})
  const timeDrafts = useRef<Partial<Record<"CURRENT_RECORD" | "GOAL_ONLY", { minutes: string; seconds: string }>>>({})
  const eventRef = useRef<HTMLSelectElement>(null)
  const minutesRef = useRef<HTMLInputElement>(null)
  const secondsRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const refs = { event: eventRef, minutes: minutesRef, seconds: secondsRef, achievedOn: dateRef }

  function changeKind(next: InstantPlanEntry["kind"]) {
    if (next === kind) return
    if (kind !== "NO_RECORD") timeDrafts.current[kind] = { minutes, seconds }
    const draft = next === "NO_RECORD" ? undefined : timeDrafts.current[next]
    setMinutes(draft?.minutes ?? "")
    setSeconds(draft?.seconds ?? "")
    setKind(next)
    setErrors({})
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (disabled) return

    const nextErrors: Errors = {}
    const selectedEvent = EVENTS.find(option => String(option.value) === event)
    if (!selectedEvent) nextErrors.event = "훈련할 종목을 선택해 주세요."

    let performanceSeconds = 0
    if (kind !== "NO_RECORD") {
      const minuteText = minutes.trim()
      const secondText = seconds.trim()
      const minuteValue = minuteText === "" ? 0 : Number(minuteText)
      const secondValue = secondText === "" ? 0 : Number(secondText)
      if (minuteText !== "" && (!/^\d+$/.test(minuteText) || !Number.isFinite(minuteValue))) {
        nextErrors.minutes = "분은 0 이상의 정수로 입력해 주세요."
      }
      if (secondText !== "" && (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(secondText)
        || !Number.isFinite(secondValue) || secondValue < 0 || secondValue >= 60)) {
        nextErrors.seconds = "초는 0 이상 60 미만으로 입력해 주세요. 소수도 가능해요."
      }
      performanceSeconds = minuteValue * 60 + secondValue
      if (!nextErrors.minutes && !nextErrors.seconds
        && (!Number.isFinite(performanceSeconds) || performanceSeconds <= 0)) {
        nextErrors.minutes = "0초보다 긴 시간을 분과 초로 입력해 주세요."
      }
    }
    if (kind === "CURRENT_RECORD") {
      if (!isCalendarDate(achievedOn)) {
        nextErrors.achievedOn = "기록을 달성한 날짜를 올바르게 입력해 주세요."
      } else if (!isCalendarDate(today)) {
        nextErrors.achievedOn = "오늘 날짜를 확인하지 못했어요. 잠시 후 다시 시도해 주세요."
      } else if (achievedOn > today) {
        nextErrors.achievedOn = "달성일은 오늘 또는 이전 날짜로 입력해 주세요."
      }
    }

    setErrors(nextErrors)
    const firstError = (["event", "minutes", "seconds", "achievedOn"] as const)
      .find(field => nextErrors[field])
    if (firstError) {
      refs[firstError].current?.focus()
      return
    }
    if (!selectedEvent) return
    if (kind === "CURRENT_RECORD") {
      onSubmit({ kind, eventDistanceM: selectedEvent.value, performanceSeconds, achievedOn })
    } else if (kind === "GOAL_ONLY") {
      onSubmit({ kind, eventDistanceM: selectedEvent.value, performanceSeconds })
    } else {
      onSubmit({ kind, eventDistanceM: selectedEvent.value })
    }
  }

  function fieldError(field: Field) {
    return errors[field]
      ? <p className="instant-plan__error" id={`${id}-${field}-error`} role="alert">{errors[field]}</p>
      : null
  }

  return (
    <form className="instant-plan" aria-labelledby={`${id}-heading`} noValidate onSubmit={submit}>
      <h2 id={`${id}-heading`} className="instant-plan__heading">내 계획 받기</h2>
      {sourceLabel && <p className="instant-plan__hint">선택한 프로그램: {sourceLabel}</p>}
      <fieldset disabled={disabled} className="instant-plan__fields">
        <legend>어떤 기준으로 시작할까요?</legend>
        <div className="instant-plan__choices">
          {([
            ["CURRENT_RECORD", "내 기록"],
            ["GOAL_ONLY", "목표만 있어요"],
            ["NO_RECORD", "기록 없이"],
          ] as const).map(([value, label]) => (
            <label key={value} className="instant-plan__choice">
              <input type="radio" name={`${id}-kind`} value={value} checked={kind === value}
                onChange={() => changeKind(value)} />
              {label}
            </label>
          ))}
        </div>
        <div className="instant-plan__field">
          <label htmlFor={`${id}-event`}>종목</label>
          <select id={`${id}-event`} ref={eventRef} value={event} onChange={e => setEvent(e.target.value)} required
            aria-invalid={Boolean(errors.event)} aria-describedby={errors.event ? `${id}-event-error` : undefined}>
            <option value="">종목 선택</option>
            {EVENTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {fieldError("event")}
        </div>
        {kind !== "NO_RECORD" && (
          <fieldset className="instant-plan__fields">
            <legend>{kind === "CURRENT_RECORD" ? "현재 기록" : "목표 기록"}</legend>
            <div className="instant-plan__time-fields">
              <div className="instant-plan__field">
                <label htmlFor={`${id}-minutes`}>분</label>
                <input id={`${id}-minutes`} ref={minutesRef} type="text" inputMode="numeric" autoComplete="off"
                  value={minutes} placeholder="0" onChange={e => setMinutes(e.target.value)}
                  aria-invalid={Boolean(errors.minutes)}
                  aria-describedby={errors.minutes ? `${id}-minutes-error` : `${id}-time-hint`} />
                {fieldError("minutes")}
              </div>
              <div className="instant-plan__field">
                <label htmlFor={`${id}-seconds`}>초</label>
                <input id={`${id}-seconds`} ref={secondsRef} type="text" inputMode="decimal" autoComplete="off"
                  value={seconds} placeholder="0" onChange={e => setSeconds(e.target.value)}
                  aria-invalid={Boolean(errors.seconds)}
                  aria-describedby={errors.seconds ? `${id}-seconds-error` : `${id}-time-hint`} />
                {fieldError("seconds")}
              </div>
            </div>
            <p id={`${id}-time-hint`} className="instant-plan__hint">초는 소수까지 입력할 수 있어요. 빈칸은 0으로 계산해요.</p>
          </fieldset>
        )}
        {kind === "CURRENT_RECORD" && (
          <div className="instant-plan__field">
            <label htmlFor={`${id}-achievedOn`}>기록 달성일</label>
            <input id={`${id}-achievedOn`} ref={dateRef} type="date" min="0001-01-01" required
              max={isCalendarDate(today) ? today : undefined} value={achievedOn}
              onChange={e => setAchievedOn(e.target.value)} aria-invalid={Boolean(errors.achievedOn)}
              aria-describedby={errors.achievedOn ? `${id}-achievedOn-error` : undefined} />
            {fieldError("achievedOn")}
          </div>
        )}
        {kind === "CURRENT_RECORD" && <p className="instant-plan__hint">입력한 현재 기록은 내 기록에도 남아요.</p>}
        {kind === "GOAL_ONLY" && <p className="instant-plan__hint">목표는 현재 실력과 구분해서 사용해요.</p>}
        {kind === "NO_RECORD" && <p className="instant-plan__hint">기록을 추정하지 않고 시작할 수 있는 계획을 확인해요.</p>}
      </fieldset>
      <div className="instant-plan__actions">
        <button className="instant-plan__button" type="submit" disabled={disabled}>내 계획 받기</button>
      </div>
    </form>
  )
}
