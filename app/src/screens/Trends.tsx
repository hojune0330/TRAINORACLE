import React from "react"
import {
  projectStructuredJournalObservation,
  selectStructuredJournalInput,
} from "../domain/journal-observation"
import { loadEntries, todayISO } from "../domain/journal-store"
import { MonthlyTrendSection } from "./trends/MonthlyTrendSection"
import { WeeklyDistanceSection } from "./trends/WeeklyDistanceSection"

export function Trends({ onBack }: { onBack?: () => void }) {
  const observations = React.useMemo(() => loadEntries().flatMap((entry) => {
    const input = selectStructuredJournalInput(entry)
    return input === null ? [] : [projectStructuredJournalObservation(input)]
  }), [])
  const today = todayISO()
  const isEmpty = observations.length === 0

  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log(`[TRENDS] mode=${isEmpty ? "empty" : "data"} observations=${observations.length}`)
    }
  }, [isEmpty, observations.length])

  return (
    <div style={{ paddingBottom: 30 }}>
      <TrendsHeader onBack={onBack} />
      {isEmpty ? (
        <div style={{ padding: "40px 20px" }}>
          <div className="hand" style={{ fontSize: 22, color: "var(--pencil)", lineHeight: 1.35 }}>
            훈련한 날도, 쉰 날도<br />기록은 모두 남아요.
          </div>
          <div style={{
            marginTop: 14,
            fontFamily: "var(--mono)",
            fontSize: 10.5,
            color: "var(--ink-3)",
            lineHeight: 1.7,
          }}>
            거리·페이스·기분·통증을 구조화해서 남기면<br />
            출처가 확인된 값만 여기서 함께 볼 수 있어요.
          </div>
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
        </>
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
        fontFamily: "var(--mono)",
        fontSize: 11,
        color: "var(--ink-2)",
      }}>← 뒤로</button>
      <h1 style={{
        minWidth: 0,
        fontFamily: "var(--mono)",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--ink)",
        textAlign: "center",
        margin: 0,
      }}>추이</h1>
      <div aria-hidden="true" />
    </div>
  )
}
