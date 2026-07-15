import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import { compactDate } from "../../domain/dates"
import { exportEntriesJSON, recentEntries, todayISO } from "../../domain/journal-store"
import type { JournalEntry } from "../../domain/journal-store"

type DeviceJournalProps = {
  readonly onOpenDay?: (date: string) => void
}

const KIND_META: Record<JournalEntry["kind"], { readonly label: string; readonly mark: string }> = {
  "post-session": { label: "훈련 후", mark: "↻" },
  evening: { label: "하루 마무리", mark: "☾" },
  race: { label: "경기", mark: "▲" },
}

function entryHeadline(entry: JournalEntry): string {
  if (entry.kind === "post-session") return entry.title || "훈련 기록"
  if (entry.kind === "race") return entry.record ? `기록 ${entry.record}` : "경기 기록"
  return entry.note || [
    entry.sleepH > 0 ? `수면 ${entry.sleepH}h` : null,
    entry.mood > 0 ? `기분 ${entry.mood}/5` : null,
  ].filter(Boolean).join(" · ") || "하루 마무리"
}

function entrySub(entry: JournalEntry): string {
  if (entry.kind === "post-session") {
    return [
      entry.distanceKm ? `${entry.distanceKm}km` : null,
      entry.durationMin ? `${entry.durationMin}min` : null,
      entry.rpe > 0 ? `RPE ${entry.rpe}` : null,
    ].filter(Boolean).join(" · ") || "훈련 후"
  }
  if (entry.kind === "race") return [entry.rank, entry.result].filter(Boolean).join(" · ")
  return [
    entry.weightKg ? `체중 ${entry.weightKg}kg` : null,
    entry.restingHr ? `안정시 HR ${entry.restingHr}` : null,
  ].filter(Boolean).join(" · ")
}

export function DeviceJournal({ onOpenDay }: DeviceJournalProps) {
  const entries = React.useMemo(() => recentEntries(5), [])

  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log(`[HOMEJ] rendered=${entries.length} kinds=${entries.map((entry) => entry.kind).join(",") || "-"}`)
    }
  }, [entries])

  if (entries.length === 0) return null
  return (
    <div style={{ padding: "24px 0 0" }}>
      <SectionLb>— 이 기기의 일지 · 최근 {entries.length}건</SectionLb>
      <div style={{ margin: "0 20px", borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
        {entries.map((entry, index) => {
          const meta = KIND_META[entry.kind]
          const headline = entryHeadline(entry)
          return (
            <button
              type="button"
              key={entry.id}
              onClick={() => onOpenDay?.(entry.date)}
              aria-label={`${compactDate(entry.date)} ${meta.label} ${headline} 상세 열기`}
              style={{
                width: "100%", padding: "12px 0", border: 0,
                borderBottom: index < entries.length - 1 ? "1px dashed var(--hair)" : 0,
                background: "transparent", color: "inherit", textAlign: "left",
                display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 10,
                alignItems: "baseline", cursor: "pointer",
              }}
            >
              <span aria-hidden="true" style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--brand)", lineHeight: 1 }}>{meta.mark}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{compactDate(entry.date)}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.08em" }}>{meta.label}</span>
                </span>
                <span style={{
                  display: "block", fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500, color: "var(--ink)",
                  marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{headline}</span>
                <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>{entrySub(entry)}</span>
              </span>
              <span style={{
                fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.1em",
                color: "var(--ink-4)",
                border: "1px solid var(--hair)", padding: "2px 5px", whiteSpace: "nowrap",
              }}>이 기기</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const EXPORT_DESCRIPTION_ID = "safe-journal-export-description"

export function SafeJournalExport() {
  const [isFullExportDialogOpen, setIsFullExportDialogOpen] = React.useState(false)

  return (
    <div style={{ padding: "28px 20px 0" }}>
      <button type="button" onClick={downloadSafeJournalExport} aria-describedby={EXPORT_DESCRIPTION_ID} style={{
        background: "transparent", border: 0, cursor: "pointer", padding: 0,
        minHeight: 44,
        fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)",
        letterSpacing: "0.08em", textDecoration: "underline", textUnderlineOffset: 3,
      }}>내 일지 데이터 내려받기 (JSON)</button>
      <div id={EXPORT_DESCRIPTION_ID} style={{ marginTop: 4, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)", lineHeight: 1.5 }}>
        메모 원문과 메모 목적은 제외해요 · 파일은 이 기기에만 저장되고 어디로도 전송되지 않아요
      </div>
      <button type="button" onClick={() => setIsFullExportDialogOpen(true)} style={{
        background: "transparent", border: 0, cursor: "pointer", padding: "8px 0 0",
        minHeight: 44,
        fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)",
        letterSpacing: "0.08em", textDecoration: "underline", textUnderlineOffset: 3,
      }}>메모 포함 파일 내보내기 (JSON)</button>
      {isFullExportDialogOpen && (
        <FullExportDialog
          onCancel={() => setIsFullExportDialogOpen(false)}
          onConfirm={() => {
            downloadJournalExport("OWNER_FULL_BACKUP")
            setIsFullExportDialogOpen(false)
          }}
        />
      )}
    </div>
  )
}

function downloadSafeJournalExport(): void {
  downloadJournalExport("SAFE")
}

function downloadJournalExport(mode: "SAFE" | "OWNER_FULL_BACKUP"): void {
  try {
    const isFullBackup = mode === "OWNER_FULL_BACKUP"
    const blob = new Blob([exportEntriesJSON({ includeRawMemos: isFullBackup })], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `trainoracle-${isFullBackup ? "full-backup" : "journal"}-${todayISO()}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    if (window.location.search.includes("uitest")) console.log("[JEXPORT] ok=true")
  } catch (error) {
    if (!(error instanceof Error)) throw error
    if (window.location.search.includes("uitest")) console.log("[JEXPORT] ok=false")
    window.alert("내보내기에 실패했어요. 잠시 후 다시 시도해 주세요.")
  }
}

function FullExportDialog({ onCancel, onConfirm }: {
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="full-export-title" style={{
      position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center",
      padding: 20, background: "rgba(16, 18, 22, 0.52)",
    }}>
      <div style={{ width: "min(100%, 360px)", background: "var(--bg)", border: "1px solid var(--ink)", padding: 18 }}>
        <div id="full-export-title" style={{ fontFamily: "var(--sans)", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>메모까지 포함할까요?</div>
        <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-2)", lineHeight: 1.65 }}>
          이 파일에는 메모 원문과 메모 목적이 함께 들어가요. 받을 사람을 확인한 뒤 파일을 만들어요.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
          <button type="button" onClick={onCancel} style={{
            minHeight: 44, border: "1px solid var(--ink)", background: "transparent", color: "var(--ink)",
            fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer",
          }}>취소</button>
          <button type="button" onClick={onConfirm} style={{
            minHeight: 44, border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--bg)",
            fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>파일 만들기</button>
        </div>
      </div>
    </div>
  )
}
