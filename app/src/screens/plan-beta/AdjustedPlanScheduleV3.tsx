import React from "react"
import { Check, CircleMinus, RefreshCw, HeartPulse } from "lucide-react"
import type { readStoredAdjustedPlanStateV5 } from "../../domain/adjusted-plan-storage-v5"
import { saveAdjustedPlanProgressV3 } from "../../domain/adjusted-plan-progress"
import type { RetainedAdjustedPlanEvidenceV3 } from "../../domain/selected-adjusted-plan-v3"
import { PrescriptionStructureV3 } from "./PrescriptionStructureV3"
import { DetailedPrescriptionView } from "./DetailedPrescriptionView"
import { ENERGY_INTENT_LABELS, PROGRESS_LABELS, formatTrainingSeconds } from "./labels"
import { isoShift } from "../../domain/dates"
import { todayISO } from "../../domain/journal-store"
import "./AdjustedPlanSchedule.css"

type Loaded = Extract<ReturnType<typeof readStoredAdjustedPlanStateV5>, { kind: "loaded" }>
export function AdjustedPlanScheduleV3({ loaded, readEvidence, onStoredChange }: {
  readonly loaded: Loaded; readonly readEvidence: () => readonly RetainedAdjustedPlanEvidenceV3[]; readonly onStoredChange: () => void;
}) {
  const plan = loaded.state.selection, start = plan.intake.startDate ?? plan.generatedAt.slice(0, 10)
  const days = [...new Set(plan.activePlan.sessions.map(s => s.day))].sort((a, b) => a - b)
  const [day, setDay] = React.useState(() => days.find(d => isoShift(start, d - 1) === todayISO()) ?? days[0]!)
  const [error, setError] = React.useState<string | null>(null), [saving, setSaving] = React.useState(false)
  const date = isoShift(start, day - 1), explanation = loaded.explanation
  return <section className="plan-active adjusted-plan-schedule" aria-labelledby="adjusted-v3-title">
    <h1 id="adjusted-v3-title">내 훈련 일정</h1><p>{start}부터 · {days.length}일 일정</p>
    <nav aria-label="훈련 날짜">{days.map(d => <button type="button" key={d} aria-pressed={d === day}
      onClick={() => { setDay(d); setError(null) }}>{isoShift(start, d - 1).slice(5).replace("-", "/")}</button>)}</nav>
    <h2>{date} ({new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(new Date(`${date}T12:00:00`))})</h2>
    {plan.activePlan.sessions.filter(s => s.day === day).sort((a, b) => a.slot.localeCompare(b.slot)).map(session => {
      const p = session.prescription, time = session.slot === "AM" ? "오전" : "오후"
      const recorded = loaded.state.progress.find(r => r.sessionDay === day && r.sessionSlot === session.slot)
      return <section key={session.slot} aria-label={`${time} 훈련`}><h3>{time} · {session.role === "REST" ? "휴식" : ENERGY_INTENT_LABELS[session.plannedEnergyIntent].title}</h3>
        {p.kind === "ADJUSTED_METHOD_V3" ? <>
          <PrescriptionStructureV3 sequence={p.projection.sequence} />
          <h4>저장 당시 기록으로 계산한 참고 시간</h4>
          <ul>{p.projection.segmentTargets.map(target => <li key={target.segmentId}>
            {target.distanceM !== null && target.targetRepSeconds !== null ? `${target.distanceM}m당 약 ${formatTrainingSeconds(target.targetRepSeconds)}`
              : target.fixedWorkSeconds !== null ? `${formatTrainingSeconds(target.fixedWorkSeconds)} 동안 · 1km당 약 ${formatTrainingSeconds(target.secondsPerKm)} 기준`
                : "거리·시간을 지정하지 않은 구간"}</li>)}</ul>
          <p>현재 몸 상태를 다시 판단한 값은 아니에요.</p>
          <details><summary>이 훈련을 하는 이유</summary><dl>{([
            ["목적", explanation.purpose], ["에너지 공급", explanation.energySupply], ["운동 구성", explanation.workRationale],
            ["회복 구성", explanation.recoveryRationale], ["주기 역할", explanation.cycleRole], ["기대하는 변화", explanation.expectedAdaptation],
            ["한계", explanation.limitations], ["기록에서 확인할 점", explanation.observation],
          ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        </> : p.kind === "PACE_TARGET" ? <DetailedPrescriptionView prescription={p} /> : p.kind === "REST" ? <p>운동을 쉬는 날이에요.</p>
          : <p>{p.durationMinutes.minimum}~{p.durationMinutes.maximum}분 · RPE {p.rpe.minimum}~{p.rpe.maximum}</p>}
        <p role="status">{recorded ? PROGRESS_LABELS[recorded.state] : "아직 진행 기록이 없어요."}</p>
        <div role="group" aria-label={`${time} 진행 기록`}>{([
          ["COMPLETED", Check], ["RESTED", CircleMinus], ["SKIPPED", RefreshCw], ["PAIN_CHECKIN", HeartPulse],
        ] as const).filter(([state]) => session.role !== "REST" || state !== "COMPLETED").map(([state, Icon]) => <button type="button" key={state}
          disabled={saving} aria-pressed={recorded?.state === state} onClick={async () => {
            setSaving(true); setError(null)
            try {
              const result = await saveAdjustedPlanProgressV3({ expectedFingerprint: loaded.state.contentFingerprint,
                progress: { sessionDay: day, sessionSlot: session.slot, state }, retained: readEvidence() })
              if (result.kind === "saved") onStoredChange()
              else setError(result.code === "PAIN_REVIEW_REQUIRED" ? "통증 확인 기록은 완료나 휴식으로 바꾸지 않아요."
                : "저장하지 못했어요. 현재 계획을 다시 확인해 주세요.")
            } catch { setError("저장하지 못했어요. 현재 계획을 다시 확인해 주세요.") }
            finally { setSaving(false) }
          }}><Icon size={16} aria-hidden="true" />{PROGRESS_LABELS[state]}</button>)}</div>
      </section>
    })}
    {error && <p role="alert">{error}</p>}
    <details><summary>저장과 이용 안내</summary><p>현재 이 기기에 저장된 계획이에요. 서버 보관은 아직 연결 중이에요.</p></details>
  </section>
}
