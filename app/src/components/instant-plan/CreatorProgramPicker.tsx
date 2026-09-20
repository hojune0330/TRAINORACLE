import { useId, useState } from "react"
import type { InstantPlanEntry, InstantPlanSource } from "../../domain/instant-plan-contract"
import {
  CREATOR_PROGRAM_REGISTRY,
  evaluateCreatorProgram,
  type CreatorProgramEvaluation,
} from "../../domain/creator-program"
import "./instant-plan.css"

export type CreatorProgramPickerProps = {
  /** Curated public metadata from the integrator, never private plan projections. */
  readonly programs?: readonly unknown[]
  readonly entry?: InstantPlanEntry
  /** Selects a source for intake. This callback must not activate a personal plan. */
  readonly onChoose: (source: Extract<InstantPlanSource, { kind: "CREATOR" }>) => void
  readonly disabled?: boolean
}

const messages: Record<CreatorProgramEvaluation["kind"], string> = {
  ELIGIBLE: "이 프로그램을 내 조건에 맞춰 확인할 수 있어요.",
  NEEDS_INPUT: "내 기록이나 목표를 넣어 적용 가능한 계획을 확인해요.",
  INVALID_PROGRAM: "현재 표시할 수 없는 프로그램이에요.",
  VERSION_MISMATCH: "프로그램이 변경됐어요. 최신 원본을 확인해 주세요.",
  WITHDRAWN: "새로 시작할 수 없는 프로그램이에요.",
  RECALLED: "프로그램을 다시 검토하고 있어요. 지금은 시작할 수 없어요.",
  NOT_REVIEWED: "적용 조건을 검토 중이라 아직 시작할 수 없어요.",
  GRANT_REQUIRED: "개인 계획으로 가져오기가 허용되지 않았어요.",
  UNSUPPORTED_ENTRY: "이 프로그램은 입력한 기록 조건으로 시작할 수 없어요.",
  UNSUPPORTED_EVENT: "선택한 종목과 다른 프로그램이에요.",
}

const eventLabels: Record<InstantPlanEntry["eventDistanceM"], string> = {
  800: "800m", 1500: "1500m", 3000: "3000m", 5000: "5km", 10000: "10km",
  21097: "하프 마라톤", 42195: "마라톤",
}

/** Public source discovery only; final rights, prescription and save checks remain with I. */
export function CreatorProgramPicker({
  programs = CREATOR_PROGRAM_REGISTRY,
  entry,
  onChoose,
  disabled = false,
}: CreatorProgramPickerProps) {
  const headingId = useId()
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null)
  const evaluated = programs.map(input => ({ input, result: evaluateCreatorProgram(input, entry) }))
  // A blocked adoption is not permission to expose an unpublished source's metadata.
  const visible = evaluated.filter(({ result }) => result.kind !== "INVALID_PROGRAM"
    && result.program.grant?.status === "ACTIVE" && result.program.grant.publicListing)

  return (
    <section className="instant-plan" aria-labelledby={headingId}>
      <h2 id={headingId} className="instant-plan__heading">제작자의 프로그램</h2>
      <p className="instant-plan__hint">프로그램을 고르면 내 조건에 맞는지 확인한 뒤 시작해요.</p>
      {selectionNotice && <p role="alert" className="instant-plan__status">{selectionNotice}</p>}
      {visible.length === 0 ? (
        <p className="instant-plan__status" role="status">
          지금은 가져올 수 있는 공개 프로그램이 없어요. 사용할 수 있는 프로그램이 준비되면 여기에 표시돼요.
        </p>
      ) : (
        <ul className="instant-plan__programs">
          {visible.map(({ result, input }, index) => {
            if (result.kind === "INVALID_PROGRAM") return null
            const { program } = result
            const selectable = result.kind === "ELIGIBLE" || result.kind === "NEEDS_INPUT"
            const statusId = `${headingId}-program-${index}-status`
            const entryKinds = new Set(program.applicability.map(item => item.kind))
            return (
              <li className="instant-plan__program" key={`${program.programId}@${program.version}`}>
                <p className="instant-plan__eyebrow">{program.author.displayName}</p>
                <h3>{program.title}</h3>
                <p>{program.audienceLabel}</p>
                <p>{program.workloadLabel}</p>
                <p>{eventLabels[program.eventDistanceM]}</p>
                <p>
                  {program.schedule.kind === "RELATIVE_CYCLE"
                    ? `시작일부터 ${program.schedule.durationDays}일`
                    : `${program.schedule.startsOn} ~ ${program.schedule.endsOn} · ${program.schedule.timeZone}`}
                </p>
                <p className="instant-plan__hint">
                  {entryKinds.has("NO_RECORD") ? "기록 없이 시작 가능한 구성이 있어요."
                    : entryKinds.has("GOAL_ONLY") ? "목표만 있어도 시작 가능한 구성이 있어요."
                    : "같은 종목의 현재 기록이 필요해요."}
                </p>
                <p id={statusId} className={selectable ? "instant-plan__hint" : "instant-plan__status"}>
                  {messages[result.kind]}
                  {program.lifecycle.status !== "ACTIVE" && program.lifecycle.notice && ` ${program.lifecycle.notice}`}
                </p>
                <button type="button" className="instant-plan__secondary"
                  disabled={disabled || !selectable} aria-describedby={statusId}
                  aria-label={`${program.title} 내게 맞춰 보기`}
                  onClick={() => {
                    if (disabled) return
                    // Recheck the latest source object before notifying the integrating screen.
                    const latest = evaluateCreatorProgram(input, entry, program)
                    if (latest.kind === "ELIGIBLE" || latest.kind === "NEEDS_INPUT") {
                      setSelectionNotice(null)
                      onChoose({ kind: "CREATOR", programId: program.programId, version: program.version })
                    } else {
                      setSelectionNotice("프로그램의 제공 조건이 변경됐어요. 목록을 다시 확인해 주세요.")
                    }
                  }}>
                  내게 맞춰 보기
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
