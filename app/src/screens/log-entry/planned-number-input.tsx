import React from "react"

export type PlannedInputDraft = Readonly<Record<string, string>>

export function parsePlannedNumber(key: string, text: string): { value: number | undefined; error: string | null } {
  if (text === "") return { value: undefined, error: null }
  const field = key.slice(key.lastIndexOf(":") + 1)
  const rpe = field === "rpe"
  const zeroAllowed = field === "recoverySeconds" || field === "seconds" && key.includes(":RECOVERY:")
  const number = /^\d*\.?\d+$|^\d+\.$/.test(text) ? Number(text) : NaN
  const valid = Number.isFinite(number) && (zeroAllowed ? number >= 0 : number > 0)
    && number <= (rpe ? 10 : 86400) && (!rpe || Number.isInteger(number))
  return valid ? { value: number, error: null } : { value: undefined,
    error: rpe ? "RPE는 1~10 사이 정수로 적어 주세요."
      : zeroAllowed ? "회복 시간은 0~86,400초로 적어 주세요."
        : "0보다 크고 86,400 이하인 숫자로 적어 주세요." }
}

export function usePlannedNumberInputs(initial?: PlannedInputDraft) {
  const [values, setValues] = React.useState<PlannedInputDraft>(initial ?? {})
  const [focusRequest, setFocusRequest] = React.useState<{ key: string; sequence: number } | null>(null)
  const invalidKeys = Object.keys(values).filter(key => parsePlannedNumber(key, values[key]!).error !== null)
  return { values, invalidKeys, focusRequest,
    revealFirstInvalid: () => { if (invalidKeys[0]) setFocusRequest(previous => ({ key: invalidKeys[0]!, sequence: (previous?.sequence ?? 0) + 1 })) },
    set: (key: string, text: string) => setValues(previous => ({ ...previous, [key]: text })),
    clear: () => setValues({}),
  }
}
export type PlannedNumberInputs = ReturnType<typeof usePlannedNumberInputs>

export function PlannedActualNumberInput({ inputKey, label, value, inputs, onValue }: {
  readonly inputKey: string; readonly label: string; readonly value: number | undefined
  readonly inputs: PlannedNumberInputs; readonly onValue: (value: number | undefined) => void
}) {
  const id = React.useId()
  const ref = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (inputs.focusRequest?.key !== inputKey || !ref.current) return
    for (let parent = ref.current.parentElement; parent; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true
    }
    ref.current.focus({ preventScroll: true })
    ref.current.scrollIntoView?.({ block: "center", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
  }, [inputs.focusRequest, inputKey])
  const text = inputs.values[inputKey] ?? (value === undefined ? "" : String(value))
  const { error } = parsePlannedNumber(inputKey, text)
  return <>
    <input ref={ref} aria-label={label} type="text" inputMode={inputKey.endsWith(":rpe") ? "numeric" : "decimal"}
      maxLength={64} placeholder="미기록" value={text} aria-invalid={error !== null}
      aria-describedby={error ? id : undefined} onChange={event => {
        const next = event.target.value
        inputs.set(inputKey, next)
        const parsed = parsePlannedNumber(inputKey, next)
        if (!parsed.error) onValue(parsed.value)
      }} />
    {error && <span id={id} role="alert">{error}</span>}
  </>
}
