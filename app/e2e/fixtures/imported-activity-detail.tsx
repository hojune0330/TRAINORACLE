import React, { useState } from "react"
import { createRoot } from "react-dom/client"
import { ImportedActivityDetail } from "../../src/components/ImportedActivityDetail"
import { RecordMetrics } from "../../src/components/RecordUI"
import { buildFileObservation } from "../../src/domain/import/file-observation"
import { parseActivityFile } from "../../src/domain/import/activity-file"
import { fileDuration } from "../../src/screens/trends/file-analysis-display"
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
const sensorPoint = (index: number) => `<Trackpoint><Time>${new Date(Date.UTC(2026, 10, 4) + index * (index + 1) * 500).toISOString()}</Time>
  ${index === 7 || index === 8 ? "" : `<Position><LatitudeDegrees>${index === 0 ? 0 : Math.sin(index / 8) / 100}</LatitudeDegrees><LongitudeDegrees>${index / 10000}</LongitudeDegrees></Position>`}
  <AltitudeMeters>${index - 5.25}</AltitudeMeters>${index === 7 || index === 8 ? "" : `<HeartRateBpm><Value>${index === 3 ? 0 : 100 + index % 19}</Value></HeartRateBpm>`}
  <Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Watts>${index === 3 ? 0 : 180 + index}</Watts><RunCadence>84.5</RunCadence></TPX></Extensions></Trackpoint>`
const sensors = parseActivityFile(`<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-11-04T00:00:00Z</Id>
  <Creator><Name>Garmin Synthetic Fixture</Name></Creator><Lap StartTime="2026-11-04T00:00:00Z"><TotalTimeSeconds>1640</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters>
  <AverageHeartRateBpm><Value>110.25</Value></AverageHeartRateBpm><TriggerMethod>Manual</TriggerMethod>
  <Track>${Array.from({ length: 20 }, (_, index) => sensorPoint(index)).join("")}</Track>
  <Track>${Array.from({ length: 21 }, (_, index) => sensorPoint(index + 20)).join("")}</Track>
  </Lap></Activity></Activities></TrainingCenterDatabase>`, "UTC").activities[0]!.observation!
function Preview() {
  const [mode, setMode] = useState("sensors")
  const [large, setLarge] = useState(false)
  const active = mode === "sensors" ? sensors : mode === "partial" ? base : empty
  return <main style={{ maxWidth: 620, margin: "0 auto", padding: 16, fontFamily: "var(--sans)", fontSize: large ? "200%" : undefined,
    ...(large ? { "--fs-body": "29px", "--fs-body-sm": "26px" } : {}) } as React.CSSProperties}>
    <p>개발 검수 · 합성 예시</p>
    <h1 style={{ fontSize: "1.5em" }}>운동 원본 상세</h1>
    <p>실제 건강 데이터·계정·API 연결을 사용하지 않는 화면입니다.</p>
    <label style={{ display: "block", marginBottom: 16 }}>검수 자료
      <select aria-label="검수 자료" style={{ minHeight: 44, maxWidth: "100%", display: "block" }} value={mode} onChange={event => setMode(event.target.value)}>
        <option value="sensors">TCX 파서 · 센서 표본</option><option value="partial">일부 누락 · 42개 랩</option><option value="empty">시각 미확인 · 랩 없음</option>
      </select>
    </label>
    <label style={{ display: "flex", alignItems: "center", minHeight: 44, gap: 8 }}>
      <input type="checkbox" checked={large} onChange={event => setLarge(event.target.checked)} />200% 글자 검수
    </label>
    <RecordMetrics category="record" label="운동 요약" items={[
      { id: "distance", label: "파일 거리", value: active.distanceMeters === null ? "미기록" : `${active.distanceMeters} m` },
      { id: "time", label: "파일의 시간", value: fileDuration(active.durationSeconds) },
    ]} />
    <ImportedActivityDetail observation={active} />
  </main>
}
if (import.meta.env.DEV) {
  const root = createRoot(document.getElementById("root")!)
  root.render(<Preview />)
  import.meta.hot?.dispose(() => root.unmount())
}

