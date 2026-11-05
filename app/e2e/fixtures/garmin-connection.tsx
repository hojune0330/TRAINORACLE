import React, { useState } from "react"
import { createRoot } from "react-dom/client"
import { GarminConnectionPanel } from "../../src/components/GarminConnectionPanel"
import { GarminActivityDetail } from "../../src/components/GarminActivityDetail"
import { syntheticGarminItem, syntheticGarminOwner, syntheticGarminReceipt, syntheticGarminStatus } from "../../src/components/GarminConnectionPanel.test-fixtures"
import { GARMIN_VERSION, parseGarminResponse, type GarminSample, type GarminTransport } from "../../src/domain/account/garmin-integration"
import { garminSamplesDigest } from "../../src/domain/account/garmin-activity-detail"
import { setActiveLocalAccount } from "../../src/domain/account/local-journal-ownership"
import { rememberStorageConsentRevision } from "../../src/domain/account/storage-consent-revision"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"

async function start() {
  const samples: GarminSample[] = Array.from({ length: 45 }, (_, index) => ({ offsetSeconds: index * index,
    heartRateBpm: index === 8 || index === 9 ? null : index === 0 ? 0 : 100 + index,
    cadenceSpm: 170 + index % 7, powerWatts: index === 0 ? 0 : 180 + index, altitudeMeters: index - 5.25,
    latitude: index === 8 || index === 9 ? null : Math.sin(index / 8) / 100, longitude: index === 8 || index === 9 ? null : index / 10000,
  }))
  const digest = await garminSamplesDigest(samples)
  const item = { ...syntheticGarminItem, detailManifest: [{ partIndex: 0, sha256: digest, sampleCount: samples.length }] }
  const scenario = new URLSearchParams(location.search).get("scenario")
  let mutations = 0, journalReads = 0
  const transport: GarminTransport = async (_owner, request) => {
    if (request.action === "confirm" && ++mutations === 1) return { ok: false, code: "UNAVAILABLE" }
    const data = request.action === "status" ? { ...syntheticGarminStatus, ...(scenario === "auto" ? { experience: { saveMode: "AUTO", preferenceRevision: 1, lastSavedAt: "2026-11-04T23:45:00Z", reviewRequiredCount: 0, reconnectRequired: false } } : {}), connection: { ...syntheticGarminStatus.connection, ...(scenario === "setup" ? { state: "DISCONNECTED" } : {}), lastSyncAt: scenario === "setup" ? null : "2026-11-04T23:45:00Z" } }
      : request.action === "inbox" ? { schemaVersion: GARMIN_VERSION, items: [{ ...item, ...(scenario === "auto" ? { state: "CONFIRMED", savedAutomatically: true, documentId: syntheticGarminReceipt.documentId, journalEntryId: syntheticGarminReceipt.journalEntryId, journalDate: syntheticGarminReceipt.date } : {}) }], nextCursor: null }
        : request.action === "read" ? { schemaVersion: GARMIN_VERSION, item: { ...item, state: "CONFIRMED", documentId: syntheticGarminReceipt.documentId } }
          : request.action === "detail" ? { schemaVersion: GARMIN_VERSION, inboxId: item.inboxId, revision: item.revision, partIndex: 0, sha256: digest, sampleCount: samples.length, samples }
            : request.action === "confirm" ? { ...syntheticGarminReceipt, kind: "already_confirmed" }
              : request.action === "dismiss" ? { schemaVersion: GARMIN_VERSION, kind: "dismissed", inboxId: item.inboxId, revision: item.revision }
                : { schemaVersion: GARMIN_VERSION, connection: { state: "REVOKED", epoch: syntheticGarminStatus.connection.epoch, lastSyncAt: null }, remoteRevocationPending: true }
    return parseGarminResponse(request, data)
  }
  setActiveLocalAccount(syntheticGarminOwner); rememberStorageConsentRevision(syntheticGarminOwner, 2)
  function Preview() {
    const [mode, setMode] = useState("connections"), [large, setLarge] = useState(false), [opened, setOpened] = useState("")
    return <main style={{ maxWidth: 620, margin: "0 auto", padding: 16, fontFamily: "var(--sans)", ...(large ? { "--fs-body": "29px", "--fs-body-sm": "26px" } : {}) } as React.CSSProperties}>
      <p>개발 검수 · 합성 예시</p><h1 style={{ fontSize: "1.5em" }}>Garmin 연결과 기록</h1><p>실제 계정·건강 자료·Garmin API를 사용하지 않아요.</p>
      <label>검수 화면 <select aria-label="검수 화면" value={mode} onChange={event => setMode(event.target.value)} style={{ minHeight: 44 }}><option value="connections">연결과 받은 기록</option><option value="detail">저장된 원본 상세</option></select></label>
      <label style={{ display: "flex", minHeight: 44, alignItems: "center", gap: 8 }}><input type="checkbox" checked={large} onChange={event => setLarge(event.target.checked)} />200% 글자 검수</label>
      {mode === "connections" ? <GarminConnectionPanel ownerId={syntheticGarminOwner} configured featureEnabled transport={transport} onOpenJournalRecord={async (date, id, current) => {
        if (++journalReads === 1 || !current()) return "UNAVAILABLE"
        setOpened(`${date} · ${id}`); setMode("detail"); return "OPENED"
      }} /> : <GarminActivityDetail ownerId={syntheticGarminOwner} documentId={syntheticGarminReceipt.documentId} transport={transport} />}
      {opened && <p>합성 일지 이동: {opened}</p>}
    </main>
  }
  const root = createRoot(document.getElementById("root")!); root.render(<Preview />); import.meta.hot?.dispose(() => root.unmount())
}
if (import.meta.env.DEV) void start()
