import type { WorkoutMemo } from "./workout-memo"
import { memoDisplayLines, memoExecutionOrder, memoExplanationSources, memoLineEmphasis, presentWorkoutMemo, type WorkoutMemoLayout, type WorkoutMemoView } from "./workout-memo-presentation"

export type MemoPaper = "yellow" | "pink" | "white"
export const MEMO_PAPERS: readonly { readonly id: MemoPaper; readonly label: string; readonly token: string }[] = [
  { id: "yellow", label: "노랑 종이", token: "--memo-yellow" },
  { id: "pink", label: "분홍 종이", token: "--memo-pink" },
  { id: "white", label: "흰 종이", token: "--surface" },
]

export function wrapMemoText(text: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    let line = ""
    for (const character of Array.from(paragraph)) {
      if (line && measure(line + character) > width) { lines.push(line.trimEnd()); line = character.trimStart() }
      else line += character
    }
    lines.push(line.trimEnd())
  }
  return lines
}

/** Deterministic local raster export of the same text model, not a screenshot or AI image. */
export async function renderWorkoutMemoPng(source: WorkoutMemo, paper: MemoPaper, selection: WorkoutMemoView | WorkoutMemoLayout = "standard"): Promise<Blob> {
  const memo = presentWorkoutMemo(source, selection)
  await document.fonts?.ready
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
    { text: `${memo.dateLabel} · ${memo.slotLabel}`, size: 32, weight: 700 },
    { text: memo.stateLabel, size: 26, weight: 500 },
    { text: memo.title, size: 38, weight: 700 },
    ...(memo.layout === "full" ? [{ text: memoExecutionOrder(memo), size: 26, weight: 600 }] : []),
    ...memoDisplayLines(memo).flatMap((line, index) => memo.layout === "compact" && !memoLineEmphasis(memo, index)
      ? [{ text: `${line.label}: ${line.text}`, size: 30, weight: 600 }]
      : [{ text: line.label, size: 26, weight: 500 }, { text: line.text, size: memoLineEmphasis(memo, index) ? 58 : 32, weight: memoLineEmphasis(memo, index) ? 800 : 600 }]),
    ...(memo.basis ? [{ text: `기준: ${memo.basis}`, size: 26, weight: 500 }] : []),
    ...(memo.view === "core" ? [memo.warnings.join(" · ")].filter(Boolean) : memo.warnings).map(text => ({ text, size: 26, weight: 600 })),
    ...(memo.view === "explained" ? [
      { text: memo.explanation.scope, size: 26, weight: 500 },
      ...memo.explanation.sections.flatMap(section => [{ text: section.label, size: 26, weight: 700 }, { text: section.text, size: 26, weight: 500 }]),
      { text: `설명 버전 ${memo.explanation.version}`, size: 26, weight: 500 },
      ...memoExplanationSources(memo).map(source => ({ text: `근거: ${source.title}${source.url ? ` (${source.url})` : ""}`, size: 26, weight: 500 })),
    ] : []),
    { text: "TRAINORACLE", size: 24, weight: 700 },
  ].map(block => {
    ctx.font = `${block.weight} ${block.size}px ${font}`
    return { ...block, lines: wrapMemoText(block.text, inner, text => ctx.measureText(text).width), lineHeight: Math.ceil(block.size * 1.4) }
  })
  const gap = memo.layout === "compact" ? 12 : 20
  const height = margin * 2 + blocks.reduce((sum, block) => sum + block.lines.length * block.lineHeight + gap, 0)
  // Very large mixed prescriptions remain available as text; never crop a recovery step.
  if (height > 16000) throw new Error("MEMO_IMAGE_TOO_LONG")
  canvas.width = width; canvas.height = height
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = foreground; ctx.textBaseline = "top"
  let y = margin
  for (const block of blocks) {
    ctx.font = `${block.weight} ${block.size}px ${font}`
    for (const line of block.lines) { ctx.fillText(line, margin, y); y += block.lineHeight }
    y += gap
  }
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("MEMO_IMAGE_FAILED")), "image/png"))
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
