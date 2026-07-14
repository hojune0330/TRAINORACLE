import React from "react"
import { IndexCard, MoodStrip } from "../../components/JournalPrimitives"
import { compactDate, dowOf, nowClock } from "../../domain/dates"
import { newEntryId, saveEntry, todayISO } from "../../domain/journal-store"
import type { JournalEntry } from "../../domain/journal-store"
import { painLevelsRequireReview } from "../../safety/memo-safety"
import { BodyDiagram, PainReviewBanner } from "./BodyDiagram"
import { PurposeScopedMemoField, usePurposeScopedMemo } from "./PurposeScopedMemoField"
import { FormSec, inputStyle, StickyBar, TopBar } from "./shared"
import type { EntryFormProps } from "./shared"

const MOOD_LABELS = ["흐림", "무덤덤", "보통", "좋음", "최고"] as const
const SLEEP_QUALITY_LABELS = ["최악", "나쁨", "보통", "좋음", "최고"] as const

export function EveningCheckin({ onBack, onDone }: EntryFormProps) {
  const [sleep, setSleep] = React.useState(0)
  const [quality, setQuality] = React.useState(0)
  const [mood, setMood] = React.useState(0)
  const [painParts, setPainParts] = React.useState<Record<string, number>>({})
  const [weight, setWeight] = React.useState("")
  const [hr, setHr] = React.useState("")
  const [saveError, setSaveError] = React.useState(false)
  const note = usePurposeScopedMemo()

  const persist = () => {
    const notePreparation = note.prepareForSave()
    if (!notePreparation.ready) return
    const entry: JournalEntry = {
      id: newEntryId(), kind: "evening", date: todayISO(),
      savedAt: new Date().toISOString(), syncState: "local",
      sleepH: sleep, sleepQuality: quality, weightKg: weight, restingHr: hr,
      painParts, mood, note: note.text,
      ...(note.text.trim() !== "" && note.purpose !== undefined ? { memoPurpose: note.purpose } : {}),
    }
    const result = saveEntry(entry)
    if (window.location.search.includes("uitest")) console.log(`[JSAVE] kind=evening ok=${result.ok}`)
    if (!result.ok) { setSaveError(true); return }
    if (notePreparation.reviewMessage === null) onDone?.("evening")
    else onDone?.("evening", notePreparation.reviewMessage)
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar onBack={onBack}>저녁 체크인</TopBar>
      <div style={{ padding: "14px 20px 0" }}>
        <IndexCard date={compactDate(todayISO())} dow={`${dowOf(todayISO())} · ${nowClock()}`} />
      </div>

      <FormSec lb={`수면 · ${sleep > 0 ? `${sleep}h` : "미기록 (움직여서 기록)"}`}>
        <input aria-label="수면 시간" type="range" min="4" max="12" step="0.5" value={sleep > 0 ? sleep : 7}
          onChange={(event) => setSleep(parseFloat(event.target.value))}
          style={{ width: "100%" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.06em", marginTop: 4 }}>
          <span>4h</span><span>8h</span><span>12h</span>
        </div>
      </FormSec>

      <FormSec lb="수면 질">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", border: "1px solid var(--ink)" }}>
          {SLEEP_QUALITY_LABELS.map((label, index) => (
            <button key={label} aria-pressed={quality === index + 1} onClick={() => setQuality(index + 1)} style={{
              padding: "10px 0", border: 0,
              background: quality === index + 1 ? "var(--ink)" : "transparent",
              color: quality === index + 1 ? "var(--bg)" : "var(--ink)",
              fontFamily: "var(--mono)", fontSize: 10.5,
              borderRight: index < 4 ? "1px solid var(--line)" : 0,
              cursor: "pointer", letterSpacing: "0.04em",
            }}>{label}</button>
          ))}
        </div>
      </FormSec>

      <FormSec lb="체중 · 안정시 심박">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <input aria-label="체중 (kg)" type="text" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="62.0" style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
            <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.06em", marginTop: 4 }}>kg · 안 재면 비워둬요</div>
          </div>
          <div>
            <input aria-label="안정시 심박 (bpm)" type="text" value={hr} onChange={(event) => setHr(event.target.value)} placeholder="55" style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
            <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.06em", marginTop: 4 }}>bpm · 아침 안정시 기준</div>
          </div>
        </div>
      </FormSec>

      <FormSec lb="통증 부위 · 정도 (탭하여 표시)">
        <BodyDiagram selected={painParts} onChange={setPainParts} />
        {painLevelsRequireReview(painParts) && <PainReviewBanner />}
      </FormSec>

      <FormSec lb="오늘 감정">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
          {MOOD_LABELS.map((label, index) => (
            <button key={label} aria-pressed={mood === index + 1} onClick={() => setMood(index + 1)} style={{
              padding: "14px 4px 10px",
              background: mood === index + 1 ? "var(--surface)" : "transparent",
              border: mood === index + 1 ? "1px solid var(--ink)" : "1px solid var(--line)",
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              borderRadius: 0,
            }}>
              <MoodStrip level={index + 1} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: mood === index + 1 ? "var(--ink)" : "var(--ink-3)", letterSpacing: "0.06em" }}>{label}</span>
            </button>
          ))}
        </div>
      </FormSec>

      <FormSec lb="오늘의 한 줄">
        <PurposeScopedMemoField
          controller={note}
          fieldId="evening-note"
          label="오늘의 메모"
          placeholder="자유롭게..."
        />
      </FormSec>
      <StickyBar onSave={persist} error={saveError} />
    </div>
  )
}
