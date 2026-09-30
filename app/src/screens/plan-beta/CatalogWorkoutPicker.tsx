import React from "react"
import { Shuffle } from "lucide-react"
import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout, catalogMethodIdentity, type WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { catalogFamilyForIntent, catalogRpe } from "@impl/prescription/catalog-session-binding"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import type { AthleteRecord } from "../../domain/athlete-records"
import { formatRecordTime } from "../../domain/athlete-record-display"
import { todayISO } from "../../domain/journal-store"
import { replaceCandidateCatalogWorkout } from "../../domain/catalog-plan-binding"
import { CatalogWorkoutDetail } from "./CatalogWorkoutDetail"
import "./catalog-workout.css"

const requirementLabels: Record<string, string> = {
  ACCELERATION_AND_DECELERATION_SPACE: "가속하고 속도를 줄일 충분한 공간이 있어요",
  RECENT_LONG_RUN_BASELINE: "최근에도 이 정도 길이의 장거리 달리기를 해봤어요",
  RECENT_THRESHOLD_VOLUME: "최근에도 이 정도 시간의 템포 훈련을 해봤어요",
  BIKE_AVAILABLE: "자전거를 사용할 수 있어요", ELLIPTICAL_AVAILABLE: "일립티컬을 사용할 수 있어요",
  WATER_SAFETY_AND_EQUIPMENT: "수중 운동 장비와 안전한 환경이 있어요",
  SWIMMING_ABILITY_AND_WATER_SAFETY: "이 훈련을 할 수 있는 수영 능력과 안전한 환경이 있어요",
  HILL_SURFACE_GRADE_RETURN: "언덕의 경사·노면과 안전한 복귀 길을 확인했어요",
  CONNECTED_HILL_FLAT_ROUTE: "언덕과 평지를 이어 달릴 안전한 코스가 있어요",
  COMPOUND_TRAINING_EXPERIENCE: "서로 다른 강도를 묶은 복합 훈련 경험이 있어요",
  HIGH_INTENSITY_REPETITION_EXPERIENCE: "짧고 강한 반복 훈련 경험이 있어요",
}
export function CatalogWorkoutPicker({ generated, intake, records, onChange, disabled = false }: {
  readonly generated: PlanGenerationSuccess; readonly intake: PlanBetaIntake; readonly records: readonly AthleteRecord[]
  readonly onChange: (next: PlanGenerationSuccess) => void; readonly disabled?: boolean
}) {
  const sessions = generated.candidates[0].sessions.filter(s => s.role !== "REST" && s.prescription.kind === "RPE_TIME_RANGE")
  const first = sessions.find(s => s.role === "QUALITY") ?? sessions[0]
  const [address, setAddress] = React.useState(first ? `${first.day}:${first.slot}` : "")
  const [choice, setChoice] = React.useState("")
  const [recordId, setRecordId] = React.useState("")
  const [confirmed, setConfirmed] = React.useState<string[]>([])
  const [seconds, setSeconds] = React.useState<Record<string, string>>({})
  const [recoveries, setRecoveries] = React.useState<Record<string, string>>({})
  const [message, setMessage] = React.useState("")
  const [acceptedDuration, setAcceptedDuration] = React.useState<string | null>(null)
  const session = sessions.find(s => `${s.day}:${s.slot}` === address) ?? first
  if (!session || session.prescription.kind !== "RPE_TIME_RANGE") return null
  const bindingId = session.prescription.catalogWorkout?.catalogId
  const pool = ALL_WORKOUT_CATALOG.filter(e => e.family === catalogFamilyForIntent(session.plannedEnergyIntent))
  const entry = pool.find(e => e.id === choice) ?? pool.find(e => e.id === bindingId) ?? pool[0]
  if (!entry) return null
  const record = records.find(r => r.id === recordId && r.eventDistanceM === 5000 && r.purpose !== "RACE_GOAL" && r.verificationState !== "UNVERIFIED")
  const inputs: WorkoutCalculationInputs = { eventDistanceM: intake.eventDistanceM, experience: intake.experienceBand,
    availableSeconds: (session.prescription.catalogWorkout?.originalEnvelope.durationMinutes.maximum ?? session.prescription.durationMinutes.maximum) * 60,
    confirmedRequirements: confirmed, segmentPaces: [],
    fiveK: record?.achievedOn ? { recordId: record.id, seconds: record.performanceSeconds, achievedAt: record.achievedOn, evaluatedAt: todayISO() } : null,
    segmentSeconds: Object.entries(seconds).filter(([, v]) => v !== "").map(([segmentId, v]) => ({ segmentId, seconds: Number(v) })),
    recoverySeconds: Object.entries(recoveries).filter(([, v]) => v !== "").map(([segmentId, v]) => ({ segmentId, seconds: Number(v) })),
  }
  const preview = calculateCatalogWorkout(entry.id, inputs)
  const withoutTimes = calculateCatalogWorkout(entry.id, { ...inputs, segmentSeconds: [], recoverySeconds: [] })
  const missing = withoutTimes?.steps.filter(s => s.seconds === null).filter((s, i, all) => all.findIndex(x => x.segmentId === s.segmentId) === i) ?? []
  const durationKey = preview?.totals.seconds ? `${address}:${entry.id}:${preview.fingerprint}` : null
  const longer = preview?.totals.seconds && preview.totals.seconds.maximum > inputs.availableSeconds!
  const acceptLonger = longer && durationKey !== null && durationKey === acceptedDuration
  const unavailable = preview?.unavailable.filter(code => code !== "TIME_BUDGET_EXCEEDED" || !acceptLonger) ?? []
  const next = preview ? replaceCandidateCatalogWorkout(generated, session, entry.id, inputs, !!acceptLonger) : null
  const nextRpe = preview?.steps.some(s => s.phase === "main" && s.kind === "WORK") ? catalogRpe(preview) : null
  const stronger = nextRpe && nextRpe.maximum > session.prescription.rpe.maximum
  const reset = (id: string) => { setChoice(id); setConfirmed([]); setSeconds({}); setRecoveries({}); setMessage(""); setAcceptedDuration(null) }
  const reason = (code: string) => requirementLabels[code] ? "운동 환경·경험 확인이 필요해요."
    : code === "TIME_BUDGET_EXCEEDED" ? "처음 계획보다 긴 구성이에요. 아래에서 시간을 확인하거나 다른 구성을 골라 주세요."
      : code === "TIME_BUDGET_UNCONFIRMED" ? "미정 구간을 정하면 전체 시간을 계산해요."
        : code === "EXPERIENCE_SCOPE" ? "현재 선택한 훈련 경험에 맞는 다른 구성을 골라 주세요." : "현재 계획의 조건에 맞지 않는 구성이에요."
  return <details className="plan-session-guidance catalog-workout-picker">
    <summary>다른 훈련으로 바꾸기</summary>
    <label>바꿀 일정<select value={address} disabled={disabled} onChange={e => { setAddress(e.target.value); reset("") }}>
      {sessions.map(s => <option key={`${s.day}:${s.slot}`} value={`${s.day}:${s.slot}`}>{s.day}일차 {s.slot === "AM" ? "오전" : "오후"}</option>)}
    </select></label>
    <button type="button" disabled={disabled || pool.length < 2} onClick={() => {
      const alternatives = pool.filter(e => e.id !== entry.id && catalogMethodIdentity(e) !== catalogMethodIdentity(entry))
      const options = alternatives.length ? alternatives : pool.filter(e => e.id !== entry.id)
      const preferred = options.filter(e => { const p = calculateCatalogWorkout(e.id, { ...inputs, confirmedRequirements: [], segmentSeconds: [], recoverySeconds: [] }); return p && !p.unavailable.length })
      reset((preferred.length ? preferred : options)[Math.floor(Math.random() * (preferred.length || options.length))]!.id)
    }}><Shuffle size={17} aria-hidden="true" /> 같은 목적의 다른 훈련</button>
    <label>훈련 구성<select value={entry.id} disabled={disabled} onChange={e => reset(e.target.value)}>
      {pool.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
    </select></label>
    {["LT", "VO2", "MIX"].includes(entry.family) && <label>참고 페이스에 사용할 5km 기록<select value={recordId} disabled={disabled} onChange={e => { setRecordId(e.target.value); setSeconds({}); setMessage("") }}>
      <option value="">기록 없이 체감 강도로</option>{records.filter(r => r.eventDistanceM === 5000 && r.purpose !== "RACE_GOAL" && r.verificationState !== "UNVERIFIED").map(r => <option key={r.id} value={r.id}>{r.achievedOn} · {formatRecordTime(r.performanceSeconds)}</option>)}
    </select></label>}
    {entry.requirements.map(r => <label key={r}><input type="checkbox" checked={confirmed.includes(r)} disabled={disabled}
      onChange={e => setConfirmed(e.target.checked ? [...confirmed, r] : confirmed.filter(x => x !== r))} />{requirementLabels[r] ?? "별도 운동 조건을 확인해 주세요."}</label>)}
    {missing.length > 0 && <details><summary>미정 구간 시간 정하기 · {missing.length}종류</summary><p>같은 구간의 반복에 적용해요. 스프린트·언덕은 장거리 경기 페이스로 환산하지 않아요.</p>
      {missing.map(s => <label key={s.segmentId}>{s.kind === "RECOVERY" ? `회복 ${s.distanceM ? `${s.distanceM}m` : "구간"}` : `${s.distanceM}m 운동 구간`} · 초
        <input type="number" inputMode="decimal" min="0.01" max="86400" step="any" disabled={disabled}
          value={(s.kind === "RECOVERY" ? recoveries : seconds)[s.segmentId] ?? ""}
          onChange={e => { (s.kind === "RECOVERY" ? setRecoveries : setSeconds)(previous => ({ ...previous, [s.segmentId]: e.target.value })); setMessage("") }} />
      </label>)}
    </details>}
    {preview && <CatalogWorkoutDetail workout={preview} />}
    {stronger && nextRpe && <p role="status">지금 훈련 RPE {session.prescription.rpe.minimum}~{session.prescription.rpe.maximum} → 새 훈련 RPE {nextRpe.minimum}~{nextRpe.maximum}. 더 강한 구성이에요. 아래 버튼을 누르면 이 강도로 바뀌어요.</p>}
    {longer && preview?.totals.seconds && <label><input type="checkbox" checked={!!acceptLonger} disabled={disabled}
      onChange={e => setAcceptedDuration(e.target.checked ? durationKey : null)} />준비·회복·정리까지 최대 {Number((preview.totals.seconds.maximum / 60).toFixed(1))}분 걸려요. 이 시간을 확인하고 직접 바꿀게요.</label>}
    {!preview && <p role="status">입력한 시간을 확인해 주세요. 0보다 큰 초 단위 숫자로 입력해요.</p>}
    {unavailable.length ? <p role="status">{[...new Set(unavailable.map(reason))].join(" ")}</p> : null}
    {preview?.unresolved.includes("RECORD_NOT_CURRENT") && <p role="status">오래된 기록이라 참고 페이스에 사용하지 않았어요.</p>}
    <button type="button" disabled={disabled || !next} onClick={() => { if (next) { onChange(next); setMessage("계획안에 반영했어요. 날짜와 훈련 횟수는 그대로예요.") } }}>이 구성으로 바꾸기</button>
    <p role="status">{message}</p>
  </details>
}
