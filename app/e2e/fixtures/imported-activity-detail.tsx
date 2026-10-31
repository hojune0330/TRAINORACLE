import React, { useState } from "react"
import { createRoot } from "react-dom/client"
import { ImportedActivityDetail } from "../../src/components/ImportedActivityDetail"
import { RecordMetrics } from "../../src/components/RecordUI"
import { buildFileObservation } from "../../src/domain/import/file-observation"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"

const laps = Array.from({ length: 42 }, (_, index) => ({
  sourceIndex: index, distanceMeters: index === 2 ? null : index === 3 ? 0 : 400,
  durationSeconds: index === 5 ? null : index === 3 ? 0 : 85 + index,
  durationMeaning: "SOURCE_DEFINED" as const,
  kind: index % 2 === 0 ? "WORK" as const : "RECOVERY" as const,
}))
const base = buildFileObservation({
  format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "detail-preview-v1",
  sourceActivityId: "synthetic-detail-review", date: "2026-10-31",
  startedAt: "2026-10-30T19:12:03-04:00", timeZone: "Asia/Seoul", sport: "RUNNING",
  distanceMeters: null, durationSeconds: null, durationMeaning: "SOURCE_DEFINED", laps,
  confirmation: { sport: "RUNNING", durationMeaning: "TIMER" },
})
const empty = buildFileObservation({
  format: "gpx", sourceProfile: "GPX_TRACK_V1", parserVersion: "detail-preview-v1",
  sourceActivityId: "synthetic-empty-detail", date: "2026-10-31",
  startedAt: null, timeZone: null, sport: "UNKNOWN", distanceMeters: 0, durationSeconds: 0,
  durationMeaning: "UNKNOWN", laps: [], confirmation: null,
})
function Preview() {
  const [mode, setMode] = useState("partial")
  const [large, setLarge] = useState(false)
  return <main style={{ maxWidth: 620, margin: "0 auto", padding: 16, fontFamily: "var(--sans)", fontSize: large ? "200%" : undefined,
    ...(large ? { "--fs-body": "29px", "--fs-body-sm": "26px" } : {}) } as React.CSSProperties}>
    <p>개발 검수 · 합성 예시</p>
    <h1 style={{ fontSize: "1.5em" }}>운동 원본 상세</h1>
    <p>실제 건강 데이터·계정·API 연결을 사용하지 않는 화면입니다.</p>
    <label style={{ display: "block", marginBottom: 16 }}>검수 자료
      <select aria-label="검수 자료" style={{ minHeight: 44, maxWidth: "100%", display: "block" }} value={mode} onChange={event => setMode(event.target.value)}>
        <option value="partial">일부 누락 · 42개 랩</option><option value="empty">시각 미확인 · 랩 없음</option>
      </select>
    </label>
    <label style={{ display: "flex", alignItems: "center", minHeight: 44, gap: 8 }}>
      <input type="checkbox" checked={large} onChange={event => setLarge(event.target.checked)} />200% 글자 검수
    </label>
    <RecordMetrics category="record" label="운동 요약" items={mode === "partial" ? [
      { id: "distance", label: "전체 거리", value: "미기록", detail: "일부 랩의 거리 없음" },
      { id: "time", label: "전체 시간", value: "미기록", detail: "일부 랩의 시간 없음" },
    ] : [
      { id: "distance", label: "거리", value: "0 m" }, { id: "time", label: "파일의 시간", value: "0초" },
    ]} />
    <ImportedActivityDetail observation={mode === "partial" ? base : empty} />
  </main>
}
if (import.meta.env.DEV) {
  const root = createRoot(document.getElementById("root")!)
  root.render(<Preview />)
  import.meta.hot?.dispose(() => root.unmount())
}

