import React from "react"
import { Check, RefreshCw } from "lucide-react"
import type { AthleteRecord } from "../../domain/athlete-records"
import {
  athleteRecordAuthorityCopy,
  formatRecordTime,
  recordPurposeLabel,
} from "../../domain/athlete-record-display"
import type { CandidatePrescriptionBinding } from "../../domain/plan-candidate-prescription"
import type { PlanEventGroup } from "@impl/plan-generator/types"
import { PlanChoice } from "./PlanChoice"

type Props = {
  readonly records: readonly AthleteRecord[]
  readonly eventGroup: Extract<PlanEventGroup, "FIVE_K" | "MIDDLE_DISTANCE">
  readonly selectedRecordId: string | null
  readonly comparisonRecordId: string | null
  readonly binding: Omit<CandidatePrescriptionBinding, "generated">
  readonly onSelectRecord: (recordId: string) => void
  readonly onCompareRecord: (recordId: string | null) => void
  readonly onConfirm: () => void
}

export function PaceEvidenceFlow({
  records,
  eventGroup,
  selectedRecordId,
  comparisonRecordId,
  binding,
  onSelectRecord,
  onCompareRecord,
  onConfirm,
}: Props) {
  const shouldFocusResult = React.useRef(false)
  const statusRef = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (!shouldFocusResult.current || binding.code === "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR") return
    statusRef.current?.focus()
    shouldFocusResult.current = false
  }, [binding])
  const supportedDistances = eventGroup === "FIVE_K"
    ? [5000]
    : [800, 1500, 3000]
  const usable = records.filter((record) => (
    record.purpose !== "RACE_GOAL" && supportedDistances.includes(record.eventDistanceM)
  ))
  const selected = usable.find((record) => record.id === selectedRecordId)
  const comparison = usable.find((record) => record.id === comparisonRecordId)
  const comparisonOptions = selected === undefined
    ? []
    : usable.filter((record) => (
      record.id !== selected.id && record.eventDistanceM === selected.eventDistanceM
    ))

  return (
    <section className="pace-evidence-flow" aria-label="개인 페이스 기준 기록">
      <header>
        <span>선택 사항 · 저장된 기록</span>
        <h2>개인 페이스 기준 기록</h2>
        <p>기록이 하나여도 자동으로 고르지 않아요. 선택한 기록만 계획의 기준이 됩니다.</p>
      </header>
      {usable.length === 0 ? (
        <p className="pace-evidence-fallback">사용할 수 있는 경기 기록이 없어 RPE 계획을 그대로 보여드려요.</p>
      ) : (
        <>
          <div className="plan-choice-list" aria-label="기준 기록 선택">
            {usable.map((record) => (
              <PlanChoice
                key={record.id}
                title={recordTitle(record)}
                detail={recordDetail(record)}
                selected={record.id === selectedRecordId}
                onClick={() => {
                  onSelectRecord(record.id)
                  onCompareRecord(null)
                }}
              />
            ))}
          </div>
          {selected !== undefined && (
            <div className="pace-evidence-confirmation">
              <strong>기준 기록 · {recordTitle(selected)}</strong>
              <span>{selected.achievedOn} · {athleteRecordAuthorityCopy(selected)}</span>
              {comparisonOptions.length > 0 && (
                <details>
                  <summary>다른 같은 종목 기록과 비교</summary>
                  <div className="plan-choice-list" aria-label="비교 기록 선택">
                    {comparisonOptions.map((record) => (
                      <PlanChoice
                        key={record.id}
                        title={`비교 기록 · ${recordTitle(record)}`}
                        detail="비교만 하며 기준 기록은 바뀌지 않음"
                        selected={record.id === comparisonRecordId}
                        onClick={() => onCompareRecord(record.id)}
                      />
                    ))}
                  </div>
                </details>
              )}
              {comparison !== undefined && (
                <p>비교만 · {recordTitle(comparison)} · {comparison.achievedOn}</p>
              )}
              <button
                className="plan-select-action"
                type="button"
                onClick={() => {
                  shouldFocusResult.current = true
                  onConfirm()
                }}
              >
                <Check aria-hidden="true" size={18} />
                이 기록으로 개인 페이스 적용
              </button>
            </div>
          )}
        </>
      )}
      <BindingStatus binding={binding} statusRef={statusRef} />
    </section>
  )
}

function BindingStatus({
  binding,
  statusRef,
}: {
  readonly binding: Omit<CandidatePrescriptionBinding, "generated">
  readonly statusRef: React.RefObject<HTMLParagraphElement>
}) {
  if (binding.kind === "bound") {
    return <p ref={statusRef} className="pace-evidence-status" role="status" tabIndex={-1}><Check aria-hidden="true" size={16} /><span className="pace-evidence-copy">선택한 기록으로 두 후보에 같은 상세 처방을 적용했어요.</span></p>
  }
  if (binding.code === "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR") return null
  return (
    <p ref={statusRef} className="pace-evidence-fallback" role="status" tabIndex={-1}>
      <RefreshCw aria-hidden="true" size={16} />
      <span className="pace-evidence-copy">{fallbackMessage(binding.code)} 두 후보 모두 원래 RPE 계획을 유지합니다.</span>
    </p>
  )
}

function fallbackMessage(code: string): string {
  if (code === "PACE_TARGET_FALLBACK_INVALID_SELECTION") return "고른 기록 정보를 확인하지 못했어요. 기록을 다시 골라 주세요."
  if (code === "PACE_TARGET_FALLBACK_ANCHOR_NOT_CURRENT") return "선택한 기록일이 현재 기준 범위를 벗어났어요."
  if (code === "PACE_TARGET_FALLBACK_EVENT_SCOPE") return "선택한 기록은 현재 지원하는 동일 종목 상세 처방 범위가 아니에요."
  if (code === "PACE_TARGET_FALLBACK_ANCHOR_UNAVAILABLE") return "선택한 기록을 저장소에서 다시 확인할 수 없어요."
  if (code === "PACE_TARGET_FALLBACK_EXPERIENCE_SCOPE") return "현재 선택한 훈련 경험 단계에서는 상세 페이스를 적용하지 않아요."
  if (code === "PACE_TARGET_FALLBACK_SAFETY_GATE") return "현재 몸 상태 확인 결과 상세 페이스를 적용하지 않아요."
  if (code === "PACE_TARGET_FALLBACK_NO_ELIGIBLE_QUALITY") return "이번 두 후보에는 상세 페이스를 넣을 고강도 세션이 없어요."
  if (code === "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT") return "선택한 기록에는 문제가 없어요. 상세 처방을 연결하는 중 문제가 생겨 안전하게 되돌렸어요."
  if (code === "PACE_TARGET_FALLBACK_STORED_SCHEMA") return "선택한 기록에는 문제가 없어요. 계산 결과를 계획 형식으로 저장하는 중 문제가 생겨 안전하게 되돌렸어요."
  return "기준 기록을 확인한 뒤 상세 페이스를 적용할 수 있어요."
}

function recordTitle(record: AthleteRecord): string {
  return `${recordPurposeLabel(record.purpose)} · ${record.eventDistanceM}m · ${formatRecordTime(record.performanceSeconds)}`
}

function recordDetail(record: AthleteRecord): string {
  return `${record.achievedOn ?? "달성일 없음"} · ${athleteRecordAuthorityCopy(record)}`
}
