import type { WorkoutMemo } from "./workout-memo"
import { companionStampUrl, type CompanionStamp } from "./training-companions"
import { memoDisplayLines, memoExplanationSources, memoLineEmphasis, memoVisibleBasis, presentWorkoutMemo, type WorkoutMemoLayout, type WorkoutMemoView } from "./workout-memo-presentation"

export type MemoPaper = "yellow" | "pink" | "white"
export const MEMO_PAPERS: readonly { readonly id: MemoPaper; readonly label: string; readonly token: string }[] = [
  { id: "yellow", label: "노랑 종이", token: "--memo-yellow" },
  { id: "pink", label: "분홍 종이", token: "--memo-pink" },
  { id: "white", label: "흰 종이", token: "--surface" },
]
// A 1080px export viewed at 360px keeps body at 16px and supporting text at 14px.
export const MEMO_IMAGE_TYPE = { body: 48, caption: 42, title: 60, main: 72 } as const

export function wrapMemoText(text: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    let line = ""
    for (const word of paragraph.match(/\S+\s*/gu) ?? [""]) {
      if (line && measure(line + word.trimEnd()) > width) { lines.push(line.trimEnd()); line = "" }
      // Keep ordinary words and pace tokens together; split only an oversized token.
      for (const character of Array.from(word)) {
        if (line && measure(line + character) > width) { lines.push(line.trimEnd()); line = character.trimStart() }
        else line += character
      }
    }
    if (line.trimEnd() || !paragraph.trim()) lines.push(line.trimEnd())
  }
  return lines
}

/** Deterministic local raster export of the same text model, not a screenshot or AI image. */
export async function renderWorkoutMemoPng(source: WorkoutMemo, paper: MemoPaper, selection: WorkoutMemoView | WorkoutMemoLayout = "standard", stamp: CompanionStamp | null = null): Promise<Blob> {
  const memo = presentWorkoutMemo(source, selection)
  await document.fonts?.ready
  const sticker = stamp ? await loadCompanionStamp(stamp) : null
  const styles = getComputedStyle(document.documentElement)
  const token = (name: string) => {
    const value = styles.getPropertyValue(name).trim()
    if (!value) throw new Error("MEMO_THEME_UNAVAILABLE")
    return value
  }
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("MEMO_CANVAS_UNAVAILABLE")
  const width = 1080, margin = 72, inner = width - margin * 2
  const font = token("--sans"), foreground = token("--ink")
  const background = token(MEMO_PAPERS.find(item => item.id === paper)!.token)
  const blocks = [
    { text: `${memo.dateLabel} · ${memo.slotLabel}`, size: MEMO_IMAGE_TYPE.body, weight: 700 },
    { text: memo.stateLabel || "훈련 계획", size: MEMO_IMAGE_TYPE.caption, weight: 500 },
    { text: memo.title, size: MEMO_IMAGE_TYPE.title, weight: 700 },
    ...(memo.totalDuration ? [{ text: memo.totalDuration, size: MEMO_IMAGE_TYPE.caption, weight: 500 }] : []),
    ...memoDisplayLines(memo).flatMap((line, index) => memo.layout === "compact" && !memoLineEmphasis(memo, index)
      ? [{ text: `${line.label}: ${line.text}`, size: MEMO_IMAGE_TYPE.body, weight: 500 }]
      : [{ text: line.label, size: MEMO_IMAGE_TYPE.caption, weight: 500 },
        ...(line.steps?.length ? line.steps.map((step, i) => `${line.steps!.length > 1 ? `${i + 1}. ` : ""}${step}`) : [line.text])
          .map(text => ({ text, size: memoLineEmphasis(memo, index) ? MEMO_IMAGE_TYPE.main : MEMO_IMAGE_TYPE.body, weight: memoLineEmphasis(memo, index) ? 800 : 500 }))]),
    ...(memoVisibleBasis(memo) ? [{ text: `기준: ${memoVisibleBasis(memo)}`, size: MEMO_IMAGE_TYPE.caption, weight: 500 }] : []),
    ...(memo.warnings.length ? [{ text: "유의사항", size: MEMO_IMAGE_TYPE.caption, weight: 700 },
      ...memo.warnings.map(text => ({ text, size: MEMO_IMAGE_TYPE.caption, weight: 500 }))] : []),
    ...(memo.view === "explained" ? [
      { text: memo.explanation.scope, size: MEMO_IMAGE_TYPE.caption, weight: 500 },
      ...memo.explanation.sections.flatMap(section => [{ text: section.label, size: MEMO_IMAGE_TYPE.body, weight: 700 }, { text: section.text, size: MEMO_IMAGE_TYPE.caption, weight: 500 }]),
      { text: `설명 버전 ${memo.explanation.version}`, size: MEMO_IMAGE_TYPE.caption, weight: 500 },
      ...memoExplanationSources(memo).map(source => ({ text: `근거: ${source.title}${source.url ? ` (${source.url})` : ""}`, size: MEMO_IMAGE_TYPE.caption, weight: 500 })),
    ] : []),
    { text: "TRAINORACLE", size: MEMO_IMAGE_TYPE.caption, weight: 700 },
  ].map(block => {
    ctx.font = `${block.weight} ${block.size}px ${font}`
    return { ...block, lines: wrapMemoText(block.text, inner, text => ctx.measureText(text).width), lineHeight: Math.ceil(block.size * 1.4) }
  })
  const gap = memo.layout === "compact" ? 24 : 32
  const height = margin * 2 + blocks.reduce((sum, block) => sum + block.lines.length * block.lineHeight + gap, 0) + (sticker ? 216 : 0)
  // Very large mixed prescriptions remain available as text; never crop a recovery step.
  if (height > 16000) throw new Error("MEMO_IMAGE_TOO_LONG")
  canvas.width = width; canvas.height = height
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = foreground; ctx.textBaseline = "top"
  let y = margin
  for (const block of blocks) {
    if (sticker && block.text === "TRAINORACLE") y = height - margin - block.lineHeight
    ctx.font = `${block.weight} ${block.size}px ${font}`
    for (const line of block.lines) { ctx.fillText(line, margin, y); y += block.lineHeight }
    y += gap
  }
  // Reserve a separate footer: a sticker never covers a number, recovery step or warning.
  if (sticker) ctx.drawImage(sticker, width - margin - 216, height - margin - 216, 216, 216)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("MEMO_IMAGE_FAILED")), "image/png"))
}

function loadCompanionStamp(stamp: CompanionStamp): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timer = window.setTimeout(() => { image.onload = null; image.onerror = null; reject(new Error("MEMO_STICKER_UNAVAILABLE")) }, 8000)
    image.onload = () => { window.clearTimeout(timer); resolve(image) }
    image.onerror = () => { window.clearTimeout(timer); reject(new Error("MEMO_STICKER_UNAVAILABLE")) }
    image.src = companionStampUrl(stamp)
  })
}

export function memoFileName(memo: WorkoutMemo): string {
  return `trainoracle-workout-${memo.date ?? "undated"}-${memo.slotLabel === "오전" ? "am" : "pm"}.png`
}

export function downloadMemo(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob), link = document.createElement("a")
  link.href = url; link.download = name
  document.body.append(link)
  try { link.click() } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
}
