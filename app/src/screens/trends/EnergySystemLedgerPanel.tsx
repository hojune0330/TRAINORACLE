import React from "react"
import { ChevronRight } from "lucide-react"
import { TermHelp } from "../../components/TermHelp"
import {
  buildEnergySystemLedger,
  energyLedgerWindow,
  summarizeCurrentPlanEnergy,
} from "../../domain/energy-system-ledger"
import type { EnergyLedgerPeriod } from "../../domain/energy-system-ledger"
import {
  ENERGY_SYSTEM_KEYS,
  ENERGY_SYSTEM_META,
} from "../../domain/energy-system-taxonomy"
import type { EnergySystemKey } from "../../domain/energy-system-taxonomy"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import type { PlanBetaState } from "../../domain/plan-beta-schema"
import { AccessibleTrendTable } from "./AccessibleTrendTable"

const PERIODS: readonly { readonly value: EnergyLedgerPeriod; readonly label: string }[] = [
  { value: "RECENT_4_WEEKS", label: "4주" },
  { value: "RECENT_8_WEEKS", label: "8주" },
  { value: "RECENT_24_WEEKS", label: "24주" },
  { value: "YEAR_TO_DATE", label: "올해" },
]

function keyClass(key: EnergySystemKey): string {
  return key.toLowerCase().replaceAll("_", "-")
}

function metricText(value: number | null, unit: string): string {
  return value === null ? "미기록" : `${value}${unit}`
}

export function EnergySystemLedgerPanel({
  observations,
  today,
  planState,
  mode,
  onOpenTrends,
}: {
  readonly observations: readonly StructuredJournalObservation[]
  readonly today: string
  readonly planState: PlanBetaState | null
  readonly mode: "compact" | "full"
  readonly onOpenTrends?: (() => void) | undefined
}) {
  const [period, setPeriod] = React.useState<EnergyLedgerPeriod>("RECENT_4_WEEKS")
  const activePeriod = mode === "compact" ? "RECENT_4_WEEKS" : period
  const ledger = React.useMemo(() => buildEnergySystemLedger(
    observations,
    energyLedgerWindow(activePeriod, today),
  ), [activePeriod, observations, today])
  const plan = React.useMemo(() => summarizeCurrentPlanEnergy(planState), [planState])

  if (mode === "compact") {
    const actualRows = ledger.rows.filter((row) => row.journalSessionCount > 0)
    const mixed = ledger.rows.find((row) => row.key === "MIXED_UNALLOCATED")
    const mixedMeta = ENERGY_SYSTEM_META.MIXED_UNALLOCATED
    return (
      <section className="energy-ledger energy-ledger--compact" aria-label="에너지 시스템 요약">
        <div className="energy-ledger__heading-row">
          <div>
            <span className="energy-ledger__eyebrow">최근 4주</span>
            <h2>에너지 시스템 기록<TermHelp term="energy-system" /></h2>
          </div>
          {onOpenTrends !== undefined && (
            <button type="button" className="energy-ledger__open" onClick={onOpenTrends} aria-label="에너지 시스템 자세히 보기">
              자세히 <ChevronRight aria-hidden="true" size={16} />
            </button>
          )}
        </div>
        {ledger.coverage === "MISSING" ? (
          <p className="energy-ledger__empty">직접 고른 에너지 시스템 기록이 아직 없어요.</p>
        ) : (
          <div className="energy-ledger__compact-list">
            {actualRows.slice(0, 4).map((row) => (
              <EnergyCompactRow key={row.key} energyKey={row.key} count={row.journalSessionCount} />
            ))}
          </div>
        )}
        <p className="energy-ledger__mixed-note">
          {mixedMeta.code} {mixedMeta.shortLabel} {ledger.coverage === "MISSING" ? "—" : `${mixed?.journalSessionCount ?? 0}회`}
        </p>
        {plan !== null && (
          <p className="energy-ledger__plan-brief">
            현재 계획 예정 {plan.plannedSessionCount}회 · 완료 표시 {plan.completedMarkCount}회
          </p>
        )}
      </section>
    )
  }

  const maxCount = Math.max(...ledger.rows.map((row) => row.journalSessionCount), 1)
  const ariaSummary = ledger.rows.map((row) => {
    const meta = ENERGY_SYSTEM_META[row.key]
    return `${meta.code} ${meta.shortLabel} ${row.journalSessionCount}회`
  }).join(", ")

  return (
    <section className="energy-ledger energy-ledger--full" aria-label="에너지 시스템 누적">
      <div className="energy-ledger__heading-row">
        <div>
          <span className="energy-ledger__eyebrow">훈련 일지 분석</span>
          <h2>에너지 시스템 누적<TermHelp term="energy-system" /></h2>
        </div>
      </div>
      <p className="energy-ledger__intro">
        몸을 측정한 결과가 아니라, 훈련 후 일지에서 직접 고른 주된 목적을 모아 보여줘요.
      </p>

      <div className="energy-ledger__periods app-compact-tabs" aria-label="에너지 시스템 분석 기간">
        {PERIODS.map((option) => (
          <button
            className="app-compact-tab"
            type="button"
            key={option.value}
            aria-pressed={period === option.value}
            onClick={() => setPeriod(option.value)}
          >
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <div className="energy-ledger__chart" role="img" aria-label={`${PERIODS.find((item) => item.value === period)?.label ?? "선택 기간"} 에너지 시스템: ${ariaSummary}`}>
        {ledger.rows.map((row) => (
          <div className={`energy-ledger__row energy-ledger__row--${keyClass(row.key)}`} key={row.key}>
            <div className="energy-ledger__label">
              <span className={`energy-dot energy-dot--${keyClass(row.key)}`} aria-hidden="true" />
              <strong>{ENERGY_SYSTEM_META[row.key].code}</strong>
              <span>{ENERGY_SYSTEM_META[row.key].shortLabel}</span>
            </div>
            <div className="energy-ledger__bar-track" aria-hidden="true">
              {ledger.coverage === "MISSING" ? (
                <span className="energy-ledger__bar-missing" />
              ) : row.journalSessionCount > 0 ? (
                <span className="energy-ledger__bar-fill" style={{ width: `${Math.max(12, (row.journalSessionCount / maxCount) * 100)}%` }} />
              ) : null}
            </div>
            <strong className="energy-ledger__count">
              {ledger.coverage === "MISSING" ? "—" : `${row.journalSessionCount}회`}
            </strong>
            <span className="energy-ledger__metrics">
              {metricText(row.durationMinutes, "분")} · {metricText(row.distanceKm, "km")} · RPE {row.meanRpe ?? "미기록"}
            </span>
          </div>
        ))}
      </div>

      <AccessibleTrendTable
        caption="에너지 시스템별 일지 누적"
        rows={ledger.rows.map((row) => ({
          key: row.key,
          label: `${ENERGY_SYSTEM_META[row.key].code} ${ENERGY_SYSTEM_META[row.key].shortLabel}`,
          value: ledger.coverage === "MISSING"
            ? "직접 선택한 기록 없음"
            : `${row.journalSessionCount}회 · ${metricText(row.durationMinutes, "분")} · ${metricText(row.distanceKm, "km")} · RPE ${row.meanRpe ?? "미기록"}`,
        }))}
      />

      <p className="energy-ledger__coverage">
        직접 선택 {ledger.includedSourceCount}건 · 제외 {ledger.excludedSourceCount}건 · 중복 {ledger.duplicateSourceCount}건
      </p>

      <CurrentPlanEnergy plan={plan} />
      <p className="energy-ledger__boundary">
        계획, 완료 표시, 실제 일지 수치는 서로 다른 기록이에요. 이 표만으로 효과·부족·위험을 판단하거나 다음 계획을 자동 변경하지 않아요.
      </p>
    </section>
  )
}

function EnergyCompactRow({ energyKey, count }: { readonly energyKey: EnergySystemKey; readonly count: number }) {
  const meta = ENERGY_SYSTEM_META[energyKey]
  return (
    <div className={`energy-ledger__compact-row energy-ledger__row--${keyClass(energyKey)}`}>
      <span className={`energy-dot energy-dot--${keyClass(energyKey)}`} aria-hidden="true" />
      <strong>{meta.code}</strong>
      <span>{meta.shortLabel}</span>
      <b>{count}회</b>
    </div>
  )
}

function CurrentPlanEnergy({ plan }: {
  readonly plan: ReturnType<typeof summarizeCurrentPlanEnergy>
}) {
  return (
    <div className="energy-ledger__plan" aria-label="현재 계획 에너지 시스템">
      <div className="energy-ledger__plan-heading">
        <strong>현재 계획</strong>
        <span>{plan === null ? "저장된 계획 없음" : `예정 ${plan.plannedSessionCount}회 · 완료 표시 ${plan.completedMarkCount}회`}</span>
      </div>
      {plan !== null && (
        <div className="energy-ledger__plan-grid">
          {ENERGY_SYSTEM_KEYS.map((key) => {
            const row = plan.rows.find((item) => item.key === key)
            return (
              <div key={key}>
                <span>{ENERGY_SYSTEM_META[key].code}</span>
                <strong>{row?.plannedSessionCount ?? 0}/{row?.completedMarkCount ?? 0}</strong>
              </div>
            )
          })}
        </div>
      )}
      {plan !== null && plan.excludedRestDayCount > 0 && (
        <p>휴식일 {plan.excludedRestDayCount}일은 에너지 시스템 훈련 횟수에서 제외했어요.</p>
      )}
    </div>
  )
}
