import React from "react"
import { Check, ChevronRight, FilePenLine } from "lucide-react"
import { compactDate, dowOf } from "../../domain/dates"
import { explicitOrMissing } from "../../domain/field-provenance"
import {
  newEntryId,
  saveEntry,
  todayISO,
  type PostSessionEntry,
} from "../../domain/journal-store"
import { useActiveContentScroll } from "../../hooks/useActiveContentScroll"
import { useOrderedStepMotion } from "../../hooks/useOrderedStepMotion"
import { TopBar } from "./shared"

type QuickStep = "activity" | "effort" | "saved"
type Outcome = NonNullable<PostSessionEntry["activityOutcome"]>
type Band = NonNullable<PostSessionEntry["rpeBand"]>
type Slot = NonNullable<PostSessionEntry["activitySlot"]>

const OUTCOMES: readonly { readonly value: Outcome; readonly label: string; readonly ink: string }[] = [
  { value: "COMPLETED", label: "계획한 훈련을 했어요", ink: "훈련 완료" },
  { value: "LIGHT_ACTIVITY", label: "가볍게 움직였어요", ink: "가벼운 운동" },
  { value: "RESTED", label: "오늘은 쉬었어요", ink: "휴식" },
  { value: "SKIPPED", label: "훈련을 건너뛰었어요", ink: "건너뜀" },
]

const RPE_BANDS: readonly { readonly value: Band; readonly label: string; readonly detail: string }[] = [
  { value: "RPE_1_2", label: "1~2", detail: "회복 움직임" },
  { value: "RPE_3_4", label: "3~4", detail: "대화 가능한 쉬운 유산소" },
  { value: "RPE_5_6", label: "5~6", detail: "꾸준한 노력" },
  { value: "RPE_7_8", label: "7~8", detail: "몇 마디만 가능한 힘든 운동" },
  { value: "RPE_9_10", label: "9~10", detail: "최대에 가까운 짧은 노력" },
  { value: "UNKNOWN", label: "모르겠어요", detail: "강도는 비워 둘게요" },
]

const ACTIVITY_SLOTS: readonly { readonly value: Slot; readonly label: string }[] = [
  { value: "SINGLE", label: "한 번" },
  { value: "AM", label: "오전" },
  { value: "PM", label: "오후" },
]

export function QuickSessionForm({
  onBack,
  onDone,
  onContinueDetailed,
  targetDate,
}: {
  readonly onBack?: () => void
  readonly onDone?: (entry: PostSessionEntry) => void
  readonly onContinueDetailed?: (entry: PostSessionEntry) => void
  readonly targetDate?: string
}) {
  const date = targetDate ?? todayISO()
  const [step, setStep] = React.useState<QuickStep>("activity")
  const [outcome, setOutcome] = React.useState<Outcome | null>(null)
  const [slot, setSlot] = React.useState<Slot | null>(null)
  const [band, setBand] = React.useState<Band | null>(null)
  const [savedEntry, setSavedEntry] = React.useState<PostSessionEntry | null>(null)
  const [saveError, setSaveError] = React.useState(false)
  const [taps, setTaps] = React.useState(0)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const motion = useOrderedStepMotion(step, ["activity", "effort", "saved"])
  useActiveContentScroll(step, stageRef, undefined, true)

  const selectOutcome = (value: Outcome) => {
    if (savedEntry !== null) return
    setTaps((current) => current + 1)
    setOutcome(value)
    if (slot !== null) setStep("effort")
  }

  const selectSlot = (value: Slot) => {
    if (savedEntry !== null) return
    setTaps((current) => current + 1)
    setSlot(value)
    if (outcome !== null) setStep("effort")
  }

  const selectBand = (value: Band) => {
    if (outcome === null || slot === null || savedEntry !== null) return
    setTaps((current) => current + 1)
    setBand(value)
    setSaveError(false)
    const entry: PostSessionEntry = {
      id: newEntryId(),
      kind: "post-session",
      date,
      savedAt: new Date().toISOString(),
      syncState: "local",
      captureDepth: "QUICK",
      activityOutcome: outcome,
      activitySlot: slot,
      rpeBand: value,
      objectiveDataState: "WAITING",
      system: "",
      title: OUTCOMES.find((candidate) => candidate.value === outcome)?.ink ?? "오늘 기록",
      distanceKm: "",
      durationMin: "",
      avgPace: "",
      rpe: 0,
      memo: "",
      fieldProvenance: {
        activityOutcome: explicitOrMissing(true),
        activitySlot: explicitOrMissing(true),
        rpeBand: explicitOrMissing(value !== "UNKNOWN"),
        system: explicitOrMissing(false),
        distanceKm: explicitOrMissing(false),
        durationMin: explicitOrMissing(false),
        avgPace: explicitOrMissing(false),
        rpe: explicitOrMissing(false),
      },
    }
    const result = saveEntry(entry)
    if (window.location.search.includes("uitest")) {
      console.log(`[QUICKLOG] step=saved taps=${taps + 1} screens=2 ok=${result.ok}`)
      console.log(`[JSAVE] kind=post-session ok=${result.ok}`)
    }
    if (!result.ok) {
      setSaveError(true)
      return
    }
    setSavedEntry(entry)
    setStep("saved")
  }

  const outcomeLabel = OUTCOMES.find((candidate) => candidate.value === outcome)?.ink
  const bandLabel = RPE_BANDS.find((candidate) => candidate.value === band)

  return (
    <div className="quick-log">
      <TopBar onBack={onBack}>빠르게 기록</TopBar>
      <section className="quick-log__paper" aria-label="지금까지 기록한 내용">
        <div className="quick-log__date">{compactDate(date)} · {dowOf(date)}</div>
        <div className="quick-log__ink-stack" aria-live="polite">
          {outcomeLabel === undefined && <span className="quick-log__empty">누르면 여기에 기록돼요.</span>}
          {outcomeLabel !== undefined && <button type="button" disabled={savedEntry !== null} onClick={() => setStep("activity")}><span>오늘</span><strong>{outcomeLabel}</strong></button>}
          {slot !== null && <button type="button" disabled={savedEntry !== null} onClick={() => setStep("activity")}><span>시간</span><strong>{ACTIVITY_SLOTS.find((candidate) => candidate.value === slot)?.label}</strong></button>}
          {bandLabel !== undefined && <button type="button" disabled={savedEntry !== null} onClick={() => setStep("effort")}><span>몸의 느낌</span><strong>{bandLabel.value === "UNKNOWN" ? "미기록" : `RPE ${bandLabel.label}`}</strong></button>}
        </div>
        {step === "saved" && <div className="quick-log__stamp" aria-label="저장 완료"><Check aria-hidden="true" /> 저장됨</div>}
      </section>

      <div
        key={step}
        ref={stageRef}
        className="quick-log__stage active-stage-content active-content-scroll-target"
        data-flow-direction={motion}
      >
        {step === "activity" && (
          <section aria-labelledby="quick-activity-title">
            <small>1 / 2</small>
            <h1 id="quick-activity-title">오늘 어떻게 움직였나요?</h1>
            <div className="quick-log__choices">
              {OUTCOMES.map((item) => <button key={item.value} type="button" aria-pressed={outcome === item.value} onClick={() => selectOutcome(item.value)}><span>{item.label}</span><ChevronRight aria-hidden="true" /></button>)}
            </div>
            {outcome !== null && (
              <div className="quick-log__slot" aria-label="운동 시간대">
                <span>언제 했나요?</span>
                <div>
                  {ACTIVITY_SLOTS.map((item) => <button key={item.value} type="button" aria-pressed={slot === item.value} onClick={() => selectSlot(item.value)}>{item.label}</button>)}
                </div>
              </div>
            )}
          </section>
        )}
        {step === "effort" && (
          <section aria-labelledby="quick-effort-title">
            <small>2 / 2</small>
            <h1 id="quick-effort-title">몸에는 어느 정도로 느껴졌나요?</h1>
            <p>정확한 숫자가 떠오르지 않으면 범위만 골라도 돼요. 범위를 임의의 숫자로 바꾸지 않아요.</p>
            <div className="quick-log__rpe-grid">
              {RPE_BANDS.map((item) => <button key={item.value} type="button" aria-pressed={band === item.value} onClick={() => selectBand(item.value)}><strong>{item.label}</strong><span>{item.detail}</span></button>)}
            </div>
            {saveError && <p className="quick-log__error" role="alert">이 기기에 저장하지 못했어요. 저장 공간을 확인한 뒤 다시 눌러 주세요.</p>}
          </section>
        )}
        {step === "saved" && savedEntry !== null && (
          <section className="quick-log__complete" aria-labelledby="quick-saved-title">
            <small>오늘 기록</small>
            <h1 id="quick-saved-title">오늘 기록을 남겼어요.</h1>
            <p>거리와 시간은 워치 기록이 들어오면 확인한 뒤 같은 일지에 더할 수 있어요.</p>
            <button className="quick-log__primary" type="button" onClick={() => onDone?.(savedEntry)}>완료</button>
            <button className="quick-log__secondary" type="button" onClick={() => onContinueDetailed?.(savedEntry)}><FilePenLine aria-hidden="true" /><span>일지 더 쓰기</span></button>
          </section>
        )}
      </div>
    </div>
  )
}
