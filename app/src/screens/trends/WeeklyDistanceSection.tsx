import { SectionLb } from "../../components/JournalPrimitives"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import { summarizeMetricCoverage } from "../../domain/trend-analysis"
import { bucketDistanceByWeek } from "../../domain/weekly-distance"
import { AccessibleTrendTable } from "./AccessibleTrendTable"

function shortWeek(start: string): string {
  return `${start.slice(5, 7)}·${start.slice(8)}~`
}

export function WeeklyDistanceSection({
  observations,
  today,
}: {
  readonly observations: readonly StructuredJournalObservation[]
  readonly today: string
}) {
  const buckets = bucketDistanceByWeek(observations, today, 4)
  const first = buckets[0]
  const last = buckets[buckets.length - 1]
  const scoped = first === undefined || last === undefined
    ? []
    : observations.filter((item) => item.loggedOn >= first.start && item.loggedOn <= last.end)
  const coverage = summarizeMetricCoverage(scoped, "DISTANCE_KM")
  const hasDistance = coverage.included > 0
  const totalKm = Math.round(buckets.reduce((sum, bucket) =>
    sum + (bucket.kind === "DATA" ? bucket.totalKm : 0), 0) * 10) / 10
  const dataValues = buckets.flatMap((bucket) => bucket.kind === "DATA" ? [bucket.totalKm] : [])
  const max = Math.max(...dataValues, 1)
  const sourceRefs = buckets.flatMap((bucket) => bucket.sourceRefs)

  return (
    <section aria-label="최근 4주 거리" style={{ padding: "24px 20px 0" }}>
      <SectionLb>— DISTANCE · 최근 4주</SectionLb>
      <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)", padding: "14px 0 10px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 28, color: "var(--ink)" }}>
            {hasDistance ? totalKm : "—"}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>
            {hasDistance ? `km · 집계 사용 ${coverage.included}건` : "집계 가능한 거리 없음"}
          </span>
        </div>
        <div style={{ marginTop: 4, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)" }}>
          집계 제외 {coverage.excluded}건 · 미기록은 0 km로 바꾸지 않아요.
        </div>

        <div
          role="img"
          aria-label={`최근 4주 거리: ${buckets.map((bucket) => bucket.kind === "DATA"
            ? `${shortWeek(bucket.start)} ${bucket.totalKm}km`
            : `${shortWeek(bucket.start)} 기록 없음`).join(", ")}`}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 10,
            alignItems: "end",
            height: 102,
            marginTop: 10,
          }}
        >
          {buckets.map((bucket) => (
            <div key={bucket.start} style={{ minWidth: 0, textAlign: "center" }}>
              {bucket.kind === "MISSING" ? (
                <div style={{
                  height: 48,
                  border: "1px dashed var(--line-2)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: "var(--ink-4)",
                }}>없음</div>
              ) : (
                <div style={{
                  height: `${Math.max(16, (bucket.totalKm / max) * 48)}px`,
                  background: "var(--ink-2)",
                }} />
              )}
              <div style={{ marginTop: 5, fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--ink-3)" }}>
                {shortWeek(bucket.start)}
              </div>
            </div>
          ))}
        </div>

        <AccessibleTrendTable
          caption="최근 4주 거리"
          rows={buckets.map((bucket) => ({
            key: bucket.start,
            label: shortWeek(bucket.start),
            value: bucket.kind === "MISSING"
              ? "집계 가능한 기록 없음"
              : `${bucket.totalKm} km · 표본 ${bucket.n}건`,
          }))}
        />

        {sourceRefs.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)" }}>
              출처 기록 보기
            </summary>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)" }}>
              {sourceRefs.map((source) => (
                <li
                  key={`${source.sourceId}-${source.observedAt ?? "unknown"}`}
                  style={{ overflowWrap: "anywhere" }}
                >
                  {source.sourceId} · {source.trustState === "ACCEPTED" ? "출처 확인" : "확인 필요"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  )
}
