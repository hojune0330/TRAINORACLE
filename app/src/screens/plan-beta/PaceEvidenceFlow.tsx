import React from "react"
import { Calculator, Check, Plus, RefreshCw } from "lucide-react"
import { useAppOverlayNavigation } from "../../components/AppOverlayNavigation"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "../../domain/account/local-account-scope"
import { isEligiblePaceRecordCurrent } from "../../domain/account/eligible-account-pace-records"
import { deriveRecordCurrentness } from "../../domain/pace-target-evidence"
import { useActiveContentScroll } from "../../hooks/useActiveContentScroll"
import type { AthleteRecord } from "../../domain/athlete-records"
import {
  athleteRecordAuthorityCopy,
  formatRecordTime,
  recordPurposeLabel,
} from "../../domain/athlete-record-display"
import type { CandidatePrescriptionBinding } from "../../domain/plan-candidate-prescription"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { PlanChoice } from "./PlanChoice"
import { derivePaceRecordOptions } from "../../domain/pace-record-options"
import { todayISO } from "../../domain/journal-store"

type Props = {
  readonly records: readonly AthleteRecord[]
  readonly eventDistanceM: PlanBetaIntake["eventDistanceM"]
  readonly selectedRecordId: string | null
  readonly comparisonRecordId: string | null
  readonly binding: Omit<CandidatePrescriptionBinding, "generated">
  readonly onSelectRecord: (recordId: string) => void
  readonly onCompareRecord: (recordId: string | null) => void
  readonly onConfirm: () => void
  readonly onManageRecords?: () => void
  readonly onUseRpe?: () => void
  readonly recordReturnCount?: number
}

export function PaceEvidenceFlow({
  records,
  eventDistanceM,
  selectedRecordId,
  comparisonRecordId,
  binding,
  onSelectRecord,
  onCompareRecord,
  onConfirm,
  onManageRecords,
  onUseRpe,
  recordReturnCount = 0,
}: Props) {
  const navigation = useAppOverlayNavigation()
  const live = React.useRef(true)
  const contextFingerprint = JSON.stringify({ eventDistanceM, selectedRecordId, comparisonRecordId, binding })
  const currentContext = React.useRef(contextFingerprint)
  currentContext.current = contextFingerprint
  React.useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const sectionRef = React.useRef<HTMLElement>(null)
  useActiveContentScroll(recordReturnCount > 0 ? recordReturnCount : null, sectionRef, sectionRef)
  const shouldFocusResult = React.useRef(false)
  const statusRef = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (!shouldFocusResult.current || binding.code === "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR") return
    statusRef.current?.focus()
    shouldFocusResult.current = false
  }, [binding])
  const usable = records.filter((record) => (
    record.eventDistanceM === eventDistanceM
  ))
  const selected = usable.find((record) => record.id === selectedRecordId)
  const choices = derivePaceRecordOptions(usable, eventDistanceM, todayISO())
  const shownRecords = [...usable].sort((a, b) => Number(b.id === choices.recommendedRecordId) - Number(a.id === choices.recommendedRecordId))
  const comparison = usable.find((record) => record.id === comparisonRecordId)
  const comparisonOptions = selected === undefined
    ? []
    : usable.filter((record) => (
      record.purpose !== "RACE_GOAL" && record.id !== selected.id && record.eventDistanceM === selected.eventDistanceM
    ))

  return (
    <section ref={sectionRef} tabIndex={-1} className="pace-evidence-flow" aria-label="개인 페이스 기준 기록">
      <header>
        <span>상세 페이스를 위한 기록 선택</span>
        <h2>개인 페이스 기준 기록</h2>
        <p>최근 경기를 먼저 추천해요. 다른 기록으로 바꿀 수도 있어요.</p>
      </header>
      {navigation?.openPaceCalculator && <button type="button" className="plan-text-action" onClick={() => {
        const scope = localAccountScopeSnapshot()
        navigation.openPaceCalculator?.({
          record: selected ?? usable.find(record => record.id === choices.recommendedRecordId),
          allowedEvents: [eventDistanceM],
          selectionLabel: "계획의 페이스 기준",
          onSelectRecord: record => {
            if (!live.current || !localAccountScopeIsCurrent(scope) || currentContext.current !== contextFingerprint
              || !isEligiblePaceRecordCurrent(record) || record.eventDistanceM !== eventDistanceM) return false
            onSelectRecord(record.id)
            onCompareRecord(null)
            return true
          },
        })
      }}><Calculator aria-hidden="true" size={18} />페이스 계산 · 기준 바꾸기</button>}
      {usable.length === 0 ? (
        <p className="pace-evidence-fallback">이 종목의 경기 기록이 없어요. 기록을 추가해도 고른 조건과 시작일은 유지돼요.</p>
      ) : (
        <>
          <div className="plan-choice-list app-choice-group" role="group" aria-label="기준 기록 선택">
            {shownRecords.map((record) => (
              <PlanChoice
                key={record.id}
                title={`${record.id === choices.recommendedRecordId ? "추천 · " : ""}${recordTitle(record)}`}
                detail={`${recordDetail(record)} · ${choices.options.find(option => option.recordId === record.id)?.badges.map(b => b === "RECENT_ACTUAL" ? "최근 경기" : b === "ROLLING_12_BEST" ? "최근 12개월 최고" : b === "LIFETIME_BEST" ? "입력된 개인 최고" : "목표").join(" · ") || "경기 기록"} · ${currentnessLabel(record)}`}
                selected={record.id === selectedRecordId}
                onClick={() => {
                  onSelectRecord(record.id)
                  onCompareRecord(null)
                }}
              />
            ))}
          </div>
          {choices.latestStatus === "AMBIGUOUS" && <p>같은 날 서로 다른 기록이 있어요. 사용할 기록을 골라 주세요.</p>}
          {selected !== undefined && (
            <div className="pace-evidence-confirmation">
              <strong>기준 기록 · {recordTitle(selected)}</strong>
              <span>{selected.achievedOn} · {athleteRecordAuthorityCopy(selected)}</span>
              {selected.purpose === "RACE_GOAL" ? <p>목표 기록을 기준으로 계산해요. 달성한 기록이나 현재 실력을 뜻하지 않아요.</p>
                : deriveRecordCurrentness(selected, new Date()) !== "CURRENT" && <p>이 기록은 지금 페이스 계산에 쓸 수 없어요. 최근 기록을 추가하거나 기록 없이 계획을 받으세요.</p>}
              {comparisonOptions.length > 0 && (
                <details>
                  <summary>다른 같은 종목 기록과 비교</summary>
                  <div className="plan-choice-list app-choice-group" role="group" aria-label="비교 기록 선택">
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
                {selected.purpose === "RACE_GOAL" ? "이 목표 기록으로 페이스 적용" : "이 기록으로 개인 페이스 적용"}
              </button>
            </div>
          )}
        </>
      )}
      {onManageRecords !== undefined && <button type="button" className="plan-text-action" onClick={onManageRecords}>
        <Plus aria-hidden="true" size={18} />경기 기록 추가·관리
      </button>}
      {onUseRpe !== undefined && <button type="button" className="plan-text-action" onClick={onUseRpe}>기록 없이 계획 받기</button>}
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
    return <p ref={statusRef} className="pace-evidence-status" role="status" tabIndex={-1}><Check aria-hidden="true" size={16} /><span className="pace-evidence-copy">선택한 기록으로 상세 훈련 수치를 계산했어요.</span></p>
  }
  if (binding.code === "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR") return null
  return (
    <p ref={statusRef} className="pace-evidence-fallback" role="status" tabIndex={-1}>
      <RefreshCw aria-hidden="true" size={16} />
      <span className="pace-evidence-copy">{fallbackMessage(binding.code)} 원래 시간·힘든 정도 안내를 유지해요.</span>
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
  if (code === "PACE_TARGET_FALLBACK_NO_ELIGIBLE_QUALITY") return "이번 두 계획안에는 상세 페이스를 넣을 주요 훈련이 없어요."
  if (code === "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT") return "선택한 기록에는 문제가 없어요. 상세 처방을 연결하는 중 문제가 생겨 안전하게 되돌렸어요."
  if (code === "PACE_TARGET_FALLBACK_STORED_SCHEMA") return "선택한 기록에는 문제가 없어요. 계산 결과를 계획 형식으로 저장하는 중 문제가 생겨 안전하게 되돌렸어요."
  if (code === "PACE_TARGET_FALLBACK_PARAMETER_SCOPE") return "이 거리에서 계산된 반복 시간이 이 훈련의 검토 범위를 벗어나요. 기록을 바꾸지 말고 다른 거리의 훈련을 골라 주세요."
  return "기준 기록을 확인한 뒤 상세 페이스를 적용할 수 있어요."
}

function recordTitle(record: AthleteRecord): string {
  return `${recordPurposeLabel(record.purpose)} · ${record.eventDistanceM}m · ${formatRecordTime(record.performanceSeconds)}`
}

function recordDetail(record: AthleteRecord): string {
  return `${record.purpose === "RACE_GOAL" ? "미달성 목표" : record.achievedOn ?? "달성일 없음"} · ${athleteRecordAuthorityCopy(record)}`
}

function currentnessLabel(record: AthleteRecord): string {
  if (record.purpose === "RACE_GOAL") return "목표 기준 · 현재 실력 아님"
  const currentness = deriveRecordCurrentness(record, new Date())
  return currentness === "CURRENT" ? "기록일 기준 범위 안" : currentness === "STALE"
    ? "오래된 기록 · 현재 페이스 계산 제외" : "기록일 확인 필요 · 현재 페이스 계산 제외"
}
