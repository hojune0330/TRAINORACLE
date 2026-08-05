import React from "react"
import { IndexCard, MoodStrip } from "../../components/JournalPrimitives"
import { compactDate, dowOf, nowClock } from "../../domain/dates"
import { explicitOrMissing } from "../../domain/field-provenance"
import {
  newEntryId,
  nextJournalSavedAt,
  saveEntry,
  savePrivateEntry,
  todayISO,
  updateEntry,
  updatePrivateEntry,
} from "../../domain/journal-store"
import type { JournalEntry } from "../../domain/journal-store"
import { painLevelsRequireReview } from "../../safety/memo-safety"
import { BodyDiagram, PainReviewBanner } from "./BodyDiagram"
import { PurposeScopedMemoField, usePurposeScopedMemo } from "./PurposeScopedMemoField"
import { inputStyle } from "./input-style"
import { FormSec, TopBar } from "./shared"
import { StickyBar } from "./StickyBar"
import type { EntryFormProps } from "./shared"

const MOOD_LABELS = ["흐림", "무덤덤", "보통", "좋음", "최고"] as const
const SLEEP_QUALITY_LABELS = ["최악", "나쁨", "보통", "좋음", "최고"] as const

export function EveningCheckin({ onBack, onDone, targetDate, initialEntry }: EntryFormProps) {
  const initial = initialEntry?.kind === "evening" ? initialEntry : undefined
  const isEditing = initial !== undefined
  const entryDate = initial?.date ?? targetDate ?? todayISO()
  const [sleep, setSleep] = React.useState(() => initial?.sleepH ?? 0)
  const [quality, setQuality] = React.useState(() => initial?.sleepQuality ?? 0)
  const [mood, setMood] = React.useState(() => initial?.mood ?? 0)
  const [painParts, setPainParts] = React.useState<Record<string, number>>(() => ({ ...initial?.painParts }))
  const [weight, setWeight] = React.useState(() => initial?.weightKg ?? "")
  const [hr, setHr] = React.useState(() => initial?.restingHr ?? "")
  const [saveError, setSaveError] = React.useState(false)
  const note = usePurposeScopedMemo(initial?.note ?? "", initial?.memoPurpose)

  const persist = async () => {
    const notePreparation = note.prepareForSave()
    if (!notePreparation.ready) return
    const entry: JournalEntry = {
      id: initial?.id ?? newEntryId(), kind: "evening", date: entryDate,
      savedAt: nextJournalSavedAt(initial?.savedAt), syncState: "local",
      sleepH: sleep, sleepQuality: quality, weightKg: weight, restingHr: hr,
      painParts, mood, note: note.text,
      fieldProvenance: {
        sleepH: explicitOrMissing(sleep > 0),
        sleepQuality: explicitOrMissing(quality > 0),
        weightKg: explicitOrMissing(weight.trim() !== ""),
        restingHr: explicitOrMissing(hr.trim() !== ""),
        painParts: explicitOrMissing(Object.values(painParts).some((level) => level > 0)),
        mood: explicitOrMissing(mood > 0),
      },
      ...(note.text.trim() !== "" && note.purpose !== undefined ? { memoPurpose: note.purpose } : {}),
    }
    const isPrivateMemo = entry.memoPurpose === "PRIVATE_SELF_ONLY" && entry.note.trim() !== ""
    const result = initial === undefined
      ? isPrivateMemo ? await savePrivateEntry(entry) : saveEntry(entry)
      : isPrivateMemo ? await updatePrivateEntry(entry, initial.savedAt) : updateEntry(entry, initial.savedAt)
    if (window.location.search.includes("uitest")) console.log(`[JSAVE] kind=evening ok=${result.ok}`)
    if (!result.ok) { setSaveError(true); return }
    if (notePreparation.reviewMessage === null) onDone?.("evening", entry)
    else onDone?.("evening", entry, notePreparation.reviewMessage)
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar onBack={onBack}>회복 · 하루 마무리</TopBar>
      <div style={{ padding: "14px 20px 0" }}>
        <IndexCard date={compactDate(entryDate)} dow={`${dowOf(entryDate)} · ${nowClock()}`} />
      </div>

      <FormSec lb={`수면 · ${sleep > 0 ? `${sleep}h` : "미기록 (움직여서 기록)"}`}>
        <div style={{ position: "relative", height: 44, display: "flex", alignItems: "center" }}>
          <div aria-hidden="true" style={{
            position: "absolute", left: 0, right: 0, top: "50%", height: 4,
            transform: "translateY(-50%)", background: "var(--line)",
          }}>
            <div style={{
              width: sleep > 0 ? `${((sleep - 4) / 8) * 100}%` : "0%",
              height: 4, background: "var(--ink)",
            }} />
          </div>
          {sleep > 0 && (
            <div aria-hidden="true" style={{
              position: "absolute", top: "50%", left: `${((sleep - 4) / 8) * 100}%`,
              width: 18, height: 18, transform: "translate(-50%, -50%)",
              borderRadius: 999, background: "var(--ink)", border: "3px solid var(--bg)",
            }} />
          )}
          {sleep === 0 && (
            <div aria-hidden="true" style={{
              position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)",
              fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)",
              letterSpacing: "0.06em", pointerEvents: "none",
            }}>아래로 움직여 기록</div>
          )}
          {/* 실제 인터랙션 표면: 접근성 트리/role(slider)은 그대로 두고,
              시각은 아래 커스텀 트랙·손잡이가 담당한다. opacity 0이 되면
              jest-dom toBeVisible이 숨김으로 판정하므로 0.01로 유지한다. */}
          <input aria-label="수면 시간" type="range" min="4" max="12" step="0.5"
            value={sleep > 0 ? sleep : 4}
            onChange={(event) => setSleep(parseFloat(event.target.value))}
            style={{ position: "absolute", inset: 0, width: "100%", height: 44, margin: 0, opacity: 0.01, cursor: "pointer" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.06em", marginTop: 4 }}>
          <span>4h</span><span>8h</span><span>12h</span>
        </div>
      </FormSec>

      <FormSec lb="수면 질">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", border: "1px solid var(--ink)" }}>
          {SLEEP_QUALITY_LABELS.map((label, index) => (
            <button key={label} aria-label={`수면 질 ${index + 1} ${label}`} aria-pressed={quality === index + 1} onClick={() => setQuality(index + 1)} style={{
              minHeight: 44, padding: "10px 0", border: 0,
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
            <button key={label} aria-label={`감정 ${index + 1} ${label}`} aria-pressed={mood === index + 1} onClick={() => setMood(index + 1)} style={{
              minHeight: 44, padding: "14px 4px 10px",
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
      <StickyBar onSave={persist} error={saveError} label={isEditing ? "수정 저장" : undefined} />
    </div>
  )
}
