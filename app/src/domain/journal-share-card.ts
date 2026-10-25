import type { JournalEntry } from "./journal-schema"
import { isValidIsoDate } from "./dates"
import { hasImportedField } from "./field-provenance"
import { companionStampUrl, type CompanionStamp } from "./training-companions"
import { MEMO_PAPERS, wrapMemoText, type MemoPaper } from "./workout-memo-export"

export type JournalShareCard = {
  readonly example: boolean
  readonly date: string
  readonly title: string
  readonly source: string
  readonly metrics: readonly { readonly label: string; readonly value: string }[]
}
export type JournalShareStyle = {
  readonly paper: MemoPaper
  readonly format: "portrait" | "square"
  readonly showDate: boolean
  readonly stamp: CompanionStamp | null
}
export const DEFAULT_JOURNAL_SHARE_STYLE: JournalShareStyle = { paper: "white", format: "portrait", showDate: false, stamp: { animal: "otter", pose: "run" } }

const numeric = (value: string): string | null => /^\d{1,5}(?:\.\d{1,3})?$/u.test(value.trim()) ? value.trim() : null

/** Explicit projection, never a screenshot of the journal or a spread of its private fields. */
export function journalShareCard(entry: JournalEntry): JournalShareCard | null {
  if (entry.kind !== "post-session" || !isValidIsoDate(entry.date)) return null
  const distance = numeric(entry.distanceKm), duration = numeric(entry.durationMin)
  const pace = /^\d{1,2}:[0-5]\d(?:\.\d)?$/u.test(entry.avgPace.trim()) ? entry.avgPace.trim() : null
  const metrics = [
    ...(distance === null ? [] : [{ label: "거리", value: `${distance} km` }]),
    ...(duration === null ? [] : [{ label: "시간", value: `${duration}분` }]),
    ...(pace === null ? [] : [{ label: "평균 페이스", value: `${pace} /km` }]),
  ]
  if (metrics.length === 0) return null
  return { example: false, date: entry.date, title: "나의 운동 기록", source: hasImportedField(entry.fieldProvenance) ? "가져온 값 포함 · 저장된 기록" : "저장된 운동 기록", metrics }
}

export function journalShareText(card: JournalShareCard, style: JournalShareStyle): string {
  return [card.example ? "예시 · 가상 기록" : "나의 운동 기록", style.showDate ? card.date : "", ...card.metrics.map(metric => `${metric.label} ${metric.value}`), card.source, "TRAINORACLE"].filter(Boolean).join("\n")
}

/** Same PNG is used for preview and export. No notes, routes, text stickers or health fields enter here. */
export async function renderJournalSharePng(card: JournalShareCard, style: JournalShareStyle): Promise<Blob> {
  await document.fonts?.ready
  const image = style.stamp ? await new Promise<HTMLImageElement>((resolve, reject) => {
    const asset = new Image()
    const timer = window.setTimeout(() => { asset.onload = null; asset.onerror = null; reject(new Error("SHARE_ASSET_UNAVAILABLE")) }, 8000)
    asset.onload = () => { clearTimeout(timer); resolve(asset) }
    asset.onerror = () => { clearTimeout(timer); reject(new Error("SHARE_ASSET_UNAVAILABLE")) }
    asset.src = companionStampUrl(style.stamp!)
  }) : null
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("SHARE_CANVAS_UNAVAILABLE")
  canvas.width = 1080; canvas.height = style.format === "portrait" ? 1350 : 1080
  const styles = getComputedStyle(document.documentElement)
  const token = (name: string) => {
    const value = styles.getPropertyValue(name).trim()
    if (!value) throw new Error("SHARE_THEME_UNAVAILABLE")
    return value
  }
  const font = token("--sans"), margin = 80, width = 920
  ctx.fillStyle = token(MEMO_PAPERS.find(paper => paper.id === style.paper)!.token)
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textBaseline = "top"
  let y = margin
  const text = (value: string, size: number, weight: number, color = "--ink") => {
    ctx.fillStyle = token(color); ctx.font = `${weight} ${size}px ${font}`
    const lines = wrapMemoText(value, width, line => ctx.measureText(line).width)
    for (const line of lines) { ctx.fillText(line, margin, y); y += size * 1.4 }
  }
  text(card.example ? "예시 · 가상 기록" : "MY JOURNAL", 30, 700, "--brand")
  if (style.showDate) { y += 16; text(card.date, 30, 500, "--ink-2") }
  y += 32; text(card.title, 54, 700); y += 36
  card.metrics.forEach((metric, index) => {
    text(metric.label, 30, 500, "--ink-2")
    text(metric.value, index === 0 ? 100 : 64, 800)
    y += 24
  })
  const footerY = canvas.height - 170
  if (y > footerY - 24) throw new Error("SHARE_CONTENT_TOO_LONG")
  if (image) ctx.drawImage(image, canvas.width - margin - 190, canvas.height - margin - 190, 190, 190)
  y = footerY; text(card.source, 26, 500, "--ink-2")
  y += 24; text("TRAINORACLE", 30, 700)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("SHARE_IMAGE_FAILED")), "image/png"))
}
