import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import type { FormEvent, SyntheticEvent } from "react"
import type { InstantPlanEntry } from "../../domain/instant-plan-contract"
import "./instant-plan.css"
import "./instant-plan-entry-steps.css"

export type InstantPlanEntryFormProps = {
  readonly onSubmit: (entry: InstantPlanEntry) => void
  /** The integrating screen supplies its local calendar date, YYYY-MM-DD. */
  readonly today: string
  /** Initial values only. Remount for a different person's or program's entry. */
  readonly initialEntry?: InstantPlanEntry
  readonly disabled?: boolean
  readonly sourceLabel?: string
  readonly onDraftChange?: (dirty: boolean) => void
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

type Step = "event" | "basis" | "details"
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

function entryFromCurrentOrGoal(
  kind: "CURRENT_RECORD" | "GOAL_ONLY",
  eventDistanceM: InstantPlanEntry["eventDistanceM"],
  performanceSeconds: number,
  achievedOn: string,
): InstantPlanEntry {
  if (kind === "CURRENT_RECORD") {
    return { kind, eventDistanceM, performanceSeconds, achievedOn: achievedOn || null }
  }
  return { kind, eventDistanceM, performanceSeconds }
}

/** Collects facts only. Eligibility, safety, generation and storage belong to the caller. */
export function InstantPlanEntryForm({
  onSubmit, today, initialEntry, disabled = false, sourceLabel, onDraftChange,
}: InstantPlanEntryFormProps) {
  const id = useId()
  const [kind, setKind] = useState<InstantPlanEntry["kind"]>(initialEntry?.kind ?? "CURRENT_RECORD")
  const [event, setEvent] = useState(initialEntry ? String(initialEntry.eventDistanceM) : "")
  const [minutes, setMinutes] = useState(() => initialTime(initialEntry).minutes)
  const [seconds, setSeconds] = useState(() => initialTime(initialEntry).seconds)
  const [achievedOn, setAchievedOn] = useState(initialEntry?.kind === "CURRENT_RECORD" ? initialEntry.achievedOn ?? "" : "")
  const [step, setStep] = useState<Step>(() => {
    if (!initialEntry) return "event"
    return initialEntry.kind === "NO_RECORD" ? "basis" : "details"
  })
  const [dateOpen, setDateOpen] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const formValue = JSON.stringify([kind, event, minutes, seconds, achievedOn])
  const initialValue = useRef(formValue)
  useLayoutEffect(() => { onDraftChange?.(formValue !== initialValue.current) }, [formValue, onDraftChange])
  useEffect(() => () => onDraftChange?.(false), [onDraftChange])

  const timeDrafts = useRef<Partial<Record<"CURRENT_RECORD" | "GOAL_ONLY", { minutes: string; seconds: string }>>>({})
  const eventButtonRef = useRef<HTMLButtonElement>(null)
  const minutesRef = useRef<HTMLInputElement>(null)
  const secondsRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const lastStep = useRef(step)

  useLayoutEffect(() => {
    if (lastStep.current === step) return
    lastStep.current = step
    stepHeadingRef.current?.focus()
  }, [step])

  useEffect(() => {
    const firstError = (["event", "minutes", "seconds", "achievedOn"] as const)
      .find(field => errors[field])
    if (!firstError) return
    if (firstError === "event") eventButtonRef.current?.focus()
    else if (firstError === "minutes") minutesRef.current?.focus()
    else if (firstError === "seconds") secondsRef.current?.focus()
    else dateRef.current?.focus()
  }, [errors, step, dateOpen])

  const selectedEvent = EVENTS.find(option => String(option.value) === event)
  const selectedEventLabel = selectedEvent?.label ?? ""

  function chooseBasis(next: InstantPlanEntry["kind"]) {
    if (next === "NO_RECORD") {
      if (kind !== "NO_RECORD") timeDrafts.current[kind] = { minutes, seconds }
      setKind("NO_RECORD")
      setErrors({})
      if (!selectedEvent) {
        setStep("event")
        setErrors({ event: "훈련할 종목을 선택해 주세요." })
        return
      }
      onSubmit({ kind: "NO_RECORD", eventDistanceM: selectedEvent.value })
      return
    }

    if (kind !== next) {
      if (kind !== "NO_RECORD") timeDrafts.current[kind] = { minutes, seconds }
      const draft = timeDrafts.current[next]
      setMinutes(draft?.minutes ?? "")
      setSeconds(draft?.seconds ?? "")
      setKind(next)
    }
    setErrors({})
    setStep("details")
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (disabled) return
    if (step !== "details") {
      if (step === "event" && !selectedEvent) setErrors({ event: "훈련할 종목을 선택해 주세요." })
      return
    }

    const nextErrors: Errors = {}
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
    if (kind === "CURRENT_RECORD" && achievedOn !== "") {
      if (!isCalendarDate(achievedOn)) {
        nextErrors.achievedOn = "기록을 달성한 날짜를 올바르게 입력해 주세요."
      } else if (!isCalendarDate(today)) {
        nextErrors.achievedOn = "오늘 날짜를 확인하지 못했어요. 잠시 후 다시 시도해 주세요."
      } else if (achievedOn > today) {
        nextErrors.achievedOn = "달성일은 오늘 또는 이전 날짜로 입력해 주세요."
      }
    }

    setErrors(nextErrors)
    if (nextErrors.achievedOn) setDateOpen(true)
    if (nextErrors.event) setStep("event")
    const firstError = (["event", "minutes", "seconds", "achievedOn"] as const)
      .find(field => nextErrors[field])
    if (firstError) return
    if (!selectedEvent || kind === "NO_RECORD") return
    onSubmit(entryFromCurrentOrGoal(kind, selectedEvent.value, performanceSeconds, achievedOn))
  }

  function fieldError(field: Field) {
    return errors[field]
      ? <p className="instant-plan__error" id={`${id}-${field}-error`} role="alert">{errors[field]}</p>
      : null
  }

  function handleDateToggle(e: SyntheticEvent<HTMLDetailsElement>) {
    setDateOpen(e.currentTarget.open)
  }

  return (
    <form className="instant-plan" aria-label="계획 시작 정보" noValidate onSubmit={submit}>
      {sourceLabel && <p className="instant-plan__hint">선택한 프로그램: {sourceLabel}</p>}
      {step === "event" && (
        <section className="instant-plan__step" aria-labelledby={`${id}-event-heading`}>
          <h2 id={`${id}-event-heading`} ref={stepHeadingRef} tabIndex={-1} className="instant-plan__step-heading">
            어떤 종목을 준비하세요?
          </h2>
          <div className="instant-plan__step-choices" role="group" aria-labelledby={`${id}-event-heading`}
            aria-describedby={errors.event ? `${id}-event-error` : undefined}>
            {EVENTS.map((option, index) => (
              <button key={option.value} ref={index === 0 ? eventButtonRef : undefined}
                className="instant-plan__step-choice" type="button" disabled={disabled}
                aria-pressed={event === String(option.value)}
                aria-describedby={errors.event ? `${id}-event-error` : undefined}
                onClick={() => { setEvent(String(option.value)); setErrors({}); setStep("basis") }}>
                {option.label}
              </button>
            ))}
          </div>
          {fieldError("event")}
        </section>
      )}
      {step === "basis" && (
        <section className="instant-plan__step" aria-labelledby={`${id}-basis-heading`}>
          <h2 id={`${id}-basis-heading`} ref={stepHeadingRef} tabIndex={-1} className="instant-plan__step-heading">
            어떤 기준으로 시작할까요?
          </h2>
          <p className="instant-plan__hint">선택한 종목: {selectedEventLabel}</p>
          <div className="instant-plan__step-choices" role="group" aria-labelledby={`${id}-basis-heading`}>
            {([
              ["CURRENT_RECORD", "내 기록"],
              ["GOAL_ONLY", "목표만 있어요"],
              ["NO_RECORD", "기록 없이"],
            ] as const).map(([value, label]) => (
              <button key={value} className="instant-plan__step-choice" type="button" disabled={disabled}
                aria-pressed={kind === value} onClick={() => chooseBasis(value)}>
                {label}
              </button>
            ))}
          </div>
          <div className="instant-plan__step-actions">
            <button className="instant-plan__secondary" type="button" disabled={disabled}
              onClick={() => { setErrors({}); setStep("event") }}>
              종목 다시 선택
            </button>
          </div>
        </section>
      )}
      {step === "details" && (
        <section className="instant-plan__step" aria-labelledby={`${id}-details-heading`}>
          <h2 id={`${id}-details-heading`} ref={stepHeadingRef} tabIndex={-1} className="instant-plan__step-heading">
            {kind === "CURRENT_RECORD" ? "현재 기록을 입력하세요" : "목표 기록을 입력하세요"}
          </h2>
          <p className="instant-plan__hint">선택한 종목: {selectedEventLabel}</p>
          {kind !== "NO_RECORD" && (
            <fieldset className="instant-plan__fields" disabled={disabled}>
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
            <details className="instant-plan__date-disclosure" open={dateOpen} onToggle={handleDateToggle}>
              <summary>기록 날짜 추가</summary>
              <div className="instant-plan__date-fields">
                <div className="instant-plan__field">
                  <label htmlFor={`${id}-achievedOn`}>기록 달성일</label>
                  <input id={`${id}-achievedOn`} ref={dateRef} type="date" min="0001-01-01"
                    max={isCalendarDate(today) ? today : undefined} value={achievedOn}
                    onChange={e => setAchievedOn(e.target.value)} aria-invalid={Boolean(errors.achievedOn)}
                    aria-describedby={errors.achievedOn ? `${id}-achievedOn-error` : undefined} />
                  {fieldError("achievedOn")}
                </div>
                <p className="instant-plan__hint">모르면 비워 두세요. 날짜가 없으면 최근 12개월 기록에서는 제외돼요.</p>
              </div>
            </details>
          )}
          {kind === "CURRENT_RECORD" && <p className="instant-plan__hint">입력한 현재 기록은 내 기록에도 남아요.</p>}
          {kind === "GOAL_ONLY" && <p className="instant-plan__hint">목표는 현재 실력과 구분해서 사용해요.</p>}
          <div className="instant-plan__step-actions">
            <button className="instant-plan__secondary" type="button" disabled={disabled}
              onClick={() => { setErrors({}); setStep("basis") }}>
              기준 다시 선택
            </button>
            <button className="instant-plan__button" type="submit" disabled={disabled}>
              {kind === "CURRENT_RECORD" ? "기록 입력 완료" : "목표 입력 완료"}
            </button>
          </div>
        </section>
      )}
    </form>
  )
}
