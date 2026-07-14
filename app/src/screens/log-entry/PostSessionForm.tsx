import React from "react"
import { IndexCard } from "../../components/JournalPrimitives"
import { compactDate, dowOf, nowClock } from "../../domain/dates"
import { newEntryId, saveEntry, todayISO } from "../../domain/journal-store"
import type { JournalEntry } from "../../domain/journal-store"
import { PurposeScopedMemoField, usePurposeScopedMemo } from "./PurposeScopedMemoField"
import { FormSec, inputStyle, StickyBar, TopBar } from "./shared"
import type { EntryFormProps } from "./shared"

const ENERGY_SYSTEMS = [
  { id: "base", c: "BA", n: "BASE", color: "#4A8FC7" },
  { id: "lt", c: "LT", n: "LT", color: "#B8A024" },
  { id: "vo2", c: "V2", n: "VO2", color: "#C7761C" },
  { id: "gly", c: "GL", n: "GLY", color: "#B8332E" },
  { id: "atp", c: "AP", n: "ATP", color: "#7A3FB5" },
  { id: "rest", c: "RE", n: "REST", color: "#7A7A70" },
] as const

export function PostSessionForm({ onBack, onDone }: EntryFormProps) {
  const [rpe, setRpe] = React.useState(0)
  const [saveError, setSaveError] = React.useState(false)
  const [system, setSystem] = React.useState("base")
  const [title, setTitle] = React.useState("")
  const [distanceKm, setDistanceKm] = React.useState("")
  const [durationMin, setDurationMin] = React.useState("")
  const [avgPace, setAvgPace] = React.useState("")
  const memo = usePurposeScopedMemo()

  const persist = () => {
    const memoPreparation = memo.prepareForSave()
    if (!memoPreparation.ready) return
    const entry: JournalEntry = {
      id: newEntryId(), kind: "post-session", date: todayISO(),
      savedAt: new Date().toISOString(), syncState: "local",
      system, title, distanceKm, durationMin, avgPace, rpe, memo: memo.text,
      ...(memo.text.trim() !== "" && memo.purpose !== undefined ? { memoPurpose: memo.purpose } : {}),
    }
    const result = saveEntry(entry)
    if (window.location.search.includes("uitest")) console.log(`[JSAVE] kind=post-session ok=${result.ok}`)
    if (!result.ok) { setSaveError(true); return }
    if (memoPreparation.reviewMessage === null) onDone?.("post-session")
    else onDone?.("post-session", memoPreparation.reviewMessage)
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar onBack={onBack}>훈련 후 · 기록</TopBar>
      <div style={{ padding: "14px 20px 0" }}>
        <IndexCard date={compactDate(todayISO())} dow={`${dowOf(todayISO())} · ${nowClock()}`} />
      </div>

      <FormSec lb="강도 시스템" help="energy-system">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ENERGY_SYSTEMS.map((energySystem) => (
            <button key={energySystem.id} aria-label={`${energySystem.c} ${energySystem.n}`} aria-pressed={system === energySystem.id} onClick={() => setSystem(energySystem.id)} style={{
              padding: "8px 12px", background: "var(--surface)",
              border: system === energySystem.id ? `1.5px solid ${energySystem.color}` : "1px solid var(--line)",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              borderRadius: 0,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: energySystem.color }}></span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>{energySystem.c}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>{energySystem.n}</span>
            </button>
          ))}
        </div>
      </FormSec>

      <FormSec lb="세션 제목">
        <input aria-label="세션 제목" type="text" value={title} onChange={(event) => setTitle(event.target.value)} style={inputStyle()} />
      </FormSec>
      <FormSec lb="거리 · 시간 · 평균 페이스" help="pace">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <input aria-label="거리 (km)" type="text" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
          <input aria-label="시간 (분)" type="text" value={durationMin} onChange={(event) => setDurationMin(event.target.value)} style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
          <input aria-label="평균 페이스 (/km)" type="text" value={avgPace} onChange={(event) => setAvgPace(event.target.value)} style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.06em" }}>
          <span>km</span><span>min</span><span>/km</span>
        </div>
      </FormSec>

      <FormSec lb={`RPE · 주관 강도 (${rpe > 0 ? `${rpe}/10` : "미선택"})`} help="rpe">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 0, border: "1px solid var(--ink)" }}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button key={value} aria-pressed={rpe === value} onClick={() => setRpe(value)} style={{
              padding: "12px 0", border: 0, cursor: "pointer",
              background: rpe === value ? "var(--ink)" : "transparent",
              color: rpe === value ? "var(--bg)" : "var(--ink)",
              fontFamily: "var(--mono)", fontSize: 12, fontWeight: 500,
              borderRight: value < 10 ? "1px solid var(--line)" : 0,
            }}>{value}</button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.06em" }}>
          <span>매우 쉬움</span><span>최대</span>
        </div>
      </FormSec>

      <FormSec lb="메모 · 손글씨처럼">
        <PurposeScopedMemoField
          controller={memo}
          fieldId="post-session-memo"
          label="훈련 메모 내용"
          placeholder="오늘 어땠는지 한 줄이라도..."
          rows={4}
        />
      </FormSec>

      <StickyBar onSave={persist} error={saveError} />
    </div>
  )
}
