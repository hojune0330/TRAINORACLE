import React from "react"
import type {
  PrescriptionOperationalComponents,
  TemplateRuntimeStatus,
} from "@impl/prescription/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import type { AthleteRecord } from "../../domain/athlete-records"
import {
  athleteRecordAuthorityCopy,
  elapsedSinceAchieved,
  formatRecordTime,
  recordPurposeLabel,
} from "../../domain/athlete-record-display"
import {
  buildPaceTargetPlanItem,
  type PaceSelectionFreshness,
} from "../../domain/pace-target-plan"
import { PlanChoice } from "./PlanChoice"

type PaceEvidenceFlowProps = {
  readonly records: readonly AthleteRecord[]
  readonly notation: string
  readonly template: TemplateRuntimeStatus
  readonly safetyGate: SafetyGateDecision
  readonly operationalComponents: PrescriptionOperationalComponents
  readonly today: Date
}

export function PaceEvidenceFlow({
  records,
  notation,
  template,
  safetyGate,
  operationalComponents,
  today,
}: PaceEvidenceFlowProps) {
  const eligibleRecords = records.filter(
    (record) => record.purpose !== "RACE_GOAL",
  )
  const goalRecords = records.filter(
    (record) => record.purpose === "RACE_GOAL",
  )
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [freshness, setFreshness] =
    React.useState<PaceSelectionFreshness | null>(null)
  const selected = eligibleRecords.find((record) => record.id === selectedId)
  const goal = selected === undefined
    ? null
    : goalRecords.find(
      (record) => record.eventDistanceM === selected.eventDistanceM,
    ) ?? null

  if (selected === undefined) {
    return (
      <section className="pace-evidence-flow" aria-labelledby="pace-record-title">
        <h1 id="pace-record-title">기준 기록을 고르세요</h1>
        <p>기록이 하나여도 자동으로 선택하지 않아요.</p>
        <div className="plan-choice-list">
          {eligibleRecords.map((record) => (
            <PlanChoice
              key={record.id}
              title={`${recordPurposeLabel(record.purpose)} · ${record.eventDistanceM}m · ${formatRecordTime(record.performanceSeconds)}`}
              detail={recordDetail(record, today)}
              selected={false}
              onClick={() => {
                setSelectedId(record.id)
                setFreshness(null)
              }}
            />
          ))}
        </div>
      </section>
    )
  }

  if (freshness === null) {
    return (
      <section className="pace-evidence-flow" aria-labelledby="pace-current-title">
        <button
          className="plan-text-action"
          type="button"
          onClick={() => setSelectedId(null)}
        >
          다른 기록 고르기
        </button>
        <h1 id="pace-current-title">이 기록이 지금 실력을 나타내나요?</h1>
        <p>{recordTitle(selected)} · {recordDetail(selected, today)}</p>
        <div className="plan-choice-list">
          <PlanChoice
            title="현재 실력으로 사용"
            detail="숫자 계산 가능 · 날짜만으로 자동 결정하지 않음"
            selected={false}
            onClick={() => setFreshness("CURRENT")}
          />
          <PlanChoice
            title="참고 기록으로만 보기"
            detail="기록은 보이지만 숫자 페이스는 만들지 않음"
            selected={false}
            onClick={() => setFreshness("STALE")}
          />
          <PlanChoice
            title="아직 모르겠어요"
            detail="확인 전까지 숫자 페이스를 만들지 않음"
            selected={false}
            onClick={() => setFreshness("UNKNOWN")}
          />
        </div>
      </section>
    )
  }

  const result = buildPaceTargetPlanItem({
    selectedRecord: selected,
    selectedFreshness: freshness,
    comparison: null,
    goalRecord: goal,
    notation,
    displayRoundingPolicyVersion: "seconds-v1",
    template,
    safetyGate,
    operationalComponents,
    today,
  })

  return (
    <section className="pace-evidence-flow" aria-labelledby="pace-result-title">
      <button
        className="plan-text-action"
        type="button"
        onClick={() => setFreshness(null)}
      >
        현재성 다시 선택
      </button>
      <h1 id="pace-result-title">개인 페이스 확인</h1>
      <PaceResult result={result} freshness={freshness} />
    </section>
  )
}

function PaceResult({
  result,
  freshness,
}: {
  readonly result: ReturnType<typeof buildPaceTargetPlanItem>
  readonly freshness: PaceSelectionFreshness
}) {
  if (result.kind === "blocked") {
    return (
      <div className="pace-evidence-fallback" role="alert">
        <strong>지금은 계획을 만들지 않아요.</strong>
        <p>통증·몸 상태 확인이 먼저예요. 숫자 페이스도 표시하지 않습니다.</p>
      </div>
    )
  }
  if (result.kind === "fallback") {
    const message = freshness === "STALE"
      ? "이 기록은 참고용으로 선택됐어요."
      : "현재 실력인지 확인이 필요해요."
    return (
      <div className="pace-evidence-fallback">
        <strong>{message}</strong>
        <p>숫자 페이스 대신 체감강도로 안내합니다.</p>
      </div>
    )
  }

  const totalRepetitions = result.item.setCount * result.item.repetitionsPerSet
  return (
    <>
      <div className="pace-evidence-session">
        <strong>{result.item.repetitionDistanceM}m {totalRepetitions}회</strong>
        {result.item.repetitionRecoverySeconds !== null && (
          <span>
            반복 사이 회복 {formatDuration(result.item.repetitionRecoverySeconds)}
          </span>
        )}
      </div>
      <dl className="pace-evidence-targets">
        <div>
          <dt>오늘 반복 목표</dt>
          <dd>{formatDuration(result.item.targetRepSeconds)}</dd>
        </div>
        {result.item.goalReference !== null && (
          <div className="pace-evidence-goal">
            <dt>목표 기록 기준</dt>
            <dd>{formatDuration(result.item.goalReference.repSeconds)} · 참고용</dd>
          </div>
        )}
      </dl>
      <div className="pace-evidence-source">
        <strong>오늘 목표 근거</strong>
        <p>
          {result.item.selectedAnchor.eventDistanceM}m{" "}
          {formatDuration(result.item.selectedAnchor.performanceSeconds)} ·{" "}
          {result.item.selectedAnchor.achievedAt} ·{" "}
          {result.item.selectedAnchor.elapsedLabel}
        </p>
        <small>
          {authorityLabel(result.item.selectedAnchor.enteredBy)} ·{" "}
          {verificationLabel(result.item.selectedAnchor.verificationState)}
        </small>
      </div>
      {result.item.goalReference !== null && (
        <p className="pace-evidence-goal-warning">
          목표 기록은 오늘 지시가 아니에요.
        </p>
      )}
    </>
  )
}

function recordTitle(record: AthleteRecord): string {
  return `${recordPurposeLabel(record.purpose)} · ${record.eventDistanceM}m · ${formatRecordTime(record.performanceSeconds)}`
}

function recordDetail(record: AthleteRecord, today: Date): string {
  const elapsed = elapsedSinceAchieved(record, today)?.label ?? "날짜 확인 필요"
  return `${record.achievedOn ?? "목표 날짜 없음"} · ${elapsed} · ${athleteRecordAuthorityCopy(record)}`
}

function formatDuration(value: number): string {
  const rounded = Math.round(value)
  const minutes = Math.floor(rounded / 60)
  const seconds = rounded % 60
  return minutes === 0 ? `${seconds}초` : `${minutes}분 ${seconds}초`
}

function authorityLabel(
  enteredBy: "ATHLETE" | "COACH" | "VERIFIED_IMPORT",
): string {
  if (enteredBy === "ATHLETE") return "직접 입력"
  if (enteredBy === "COACH") return "코치 입력"
  return "확인된 가져오기"
}

function verificationLabel(
  verificationState: "VERIFIED" | "SELF_REPORTED" | "UNVERIFIED",
): string {
  if (verificationState === "VERIFIED") return "확인된 기록"
  if (verificationState === "SELF_REPORTED") return "자기 보고 기록"
  return "검증되지 않은 기록"
}
