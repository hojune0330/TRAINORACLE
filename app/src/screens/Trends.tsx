import React from "react"
import { ArrowLeft } from "lucide-react"
import {
  projectStructuredJournalObservation,
  selectStructuredJournalInput,
} from "../domain/journal-observation"
import { analysisExclusionSummary, loadEntries, todayISO } from "../domain/journal-store"
import { MonthlyTrendSection } from "./trends/MonthlyTrendSection"
import { WeeklyDistanceSection } from "./trends/WeeklyDistanceSection"
import { FatigueExperimentPanel } from "./trends/FatigueExperimentPanel"
import { productFeatures } from "../domain/product-features"
import { GuidedEmptyState } from "../components/GuidedEmptyState"

export function Trends({ onBack, onWriteLog }: {
  readonly onBack?: (() => void) | undefined
  readonly onWriteLog?: (() => void) | undefined
}) {
  const observations = React.useMemo(() => loadEntries().flatMap((entry) => {
    const input = selectStructuredJournalInput(entry)
    return input === null ? [] : [projectStructuredJournalObservation(input)]
  }), [])
  const today = todayISO()
  const isEmpty = observations.length === 0
  /**
   * 값을 적었는데도 추이에 못 들어간 일지 개수 (Q1).
   * 화면이 침묵하면 사용자는 자기가 적은 값이 왜 그래프에 없는지 알 수 없다.
   * 이 화면의 실제 관문(eligibleMetricValue)에서 가져온 값과 출처 없는 값이
   * 0km로 떨어지는 것을 실행으로 확인한 뒤 붙였다.
   */
  const exclusion = React.useMemo(() => analysisExclusionSummary(), [])

  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log(`[TRENDS] mode=${isEmpty ? "empty" : "data"} observations=${observations.length}`)
    }
  }, [isEmpty, observations.length])

  return (
    <div style={{ paddingBottom: 30 }}>
      <TrendsHeader onBack={onBack} />
      {isEmpty ? (
        <div style={{ padding: "0 20px" }}>
          <GuidedEmptyState
            title="기록이 쌓이면 변화가 보여요"
            description="훈련한 날과 쉰 날의 거리·시간·RPE·기분을 직접 남기면 주간과 월간 흐름으로 정리해 드려요."
            actionLabel="첫 기록 남기기"
            onAction={onWriteLog}
          />
          <AnalysisExclusionNotice summary={exclusion} />
        </div>
      ) : (
        <>
          <WeeklyDistanceSection observations={observations} today={today} />
          <MonthlyTrendSection observations={observations} today={today} />
          <div style={{
            padding: "24px 20px 0",
            fontFamily: "var(--mono)",
            fontSize: 9.5,
            color: "var(--ink-4)",
            lineHeight: 1.6,
          }}>
            이 화면은 출처가 확인된 구조화 기록의 설명 통계예요. 개인 메모는 읽지 않으며,
            계획·안전 판정·다음 훈련 결정에는 쓰이지 않아요.
          </div>
          <div style={{ padding: "0 20px" }}>
            <AnalysisExclusionNotice summary={exclusion} />
          </div>
        </>
      )}
      {productFeatures().experimentalFatigue && <FatigueExperimentPanel />}
    </div>
  )
}

/**
 * 적어 둔 수치가 추이에서 빠졌다는 사실을 화면이 직접 말한다 (Q1).
 *
 * 두 원인을 **따로** 보여주는 이유: 사용자가 할 수 있는 일이 정반대다.
 *  - 가져온 값: 직접 다시 적으면 추이에 들어간다 → 행동을 안내한다
 *  - 출처 없음: 사용자가 할 수 있는 게 없다(앱 문제) → 행동을 요구하지 않는다
 * 뭉치면 "직접 적어 주세요"라며 불가능한 일을 요구하는 안내가 된다.
 *
 * 알릴 것이 없으면 아무것도 그리지 않는다. 빈 안내는 소음이다.
 */
function AnalysisExclusionNotice({ summary }: {
  readonly summary: {
    readonly excludedImported: number
    readonly excludedNoProvenance: number
  }
}) {
  const { excludedImported, excludedNoProvenance } = summary
  if (excludedImported === 0 && excludedNoProvenance === 0) return null

  return (
    <div
      data-testid="trends-analysis-exclusion"
      role="note"
      style={{
        marginTop: 14, padding: "10px 12px",
        border: "1px solid var(--line)", background: "transparent",
        fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-2)",
        letterSpacing: "0.02em", lineHeight: 1.7,
      }}
    >
      {excludedImported > 0 && (
        <div data-testid="trends-excluded-imported">
          워치·앱에서 <b>가져온 일지 {excludedImported}개</b>의 수치는 이 추이에 넣지 않았어요.
          기기가 계산한 값과 직접 적은 값을 섞으면 추이가 흐려지기 때문이에요.
          <br />
          일지에는 그대로 남아 있어요. 추이에도 넣고 싶으면 훈련 후 일지에 직접 적어 주세요.
        </div>
      )}
      {excludedNoProvenance > 0 && (
        <div
          data-testid="trends-excluded-no-provenance"
          style={{ marginTop: excludedImported > 0 ? 8 : 0 }}
        >
          <b>일지 {excludedNoProvenance}개</b>는 수치가 어디서 왔는지(직접 적은 값인지)
          기록이 없어서 추이에 넣지 못했어요. 예전 버전에서 저장했거나, 그 정보가 없는
          백업 파일에서 되돌린 일지예요.
          <br />
          일지 내용은 그대로 있어요. 이건 앱이 고쳐야 할 부분이라 따로 알려 드려요.
        </div>
      )}
    </div>
  )
}

function TrendsHeader({ onBack }: { readonly onBack?: (() => void) | undefined }) {
  return (
    <div style={{
      padding: "12px 16px",
      borderBottom: "1px solid var(--line)",
      display: "grid",
      gridTemplateColumns: "64px minmax(0, 1fr) 64px",
      alignItems: "center",
      background: "var(--bg)",
    }}>
      <button type="button" onClick={onBack} style={{
        background: "transparent",
        border: 0,
        cursor: "pointer",
        padding: 4,
        minWidth: 64,
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--mono)",
        fontSize: 11,
        color: "var(--ink-2)",
      }}>
        <ArrowLeft aria-hidden="true" size={16} />
        <span>뒤로</span>
      </button>
      <h1 style={{
        minWidth: 0,
        fontFamily: "var(--mono)",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--ink)",
        textAlign: "center",
        margin: 0,
      }}>분석</h1>
      <div aria-hidden="true" />
    </div>
  )
}
