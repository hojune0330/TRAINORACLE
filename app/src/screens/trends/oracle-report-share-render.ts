import { shareKm, type OracleShareSnapshot } from "../../domain/oracle-report-share"
import { wrapMemoText } from "../../domain/workout-memo-export"

export const ORACLE_SHARE_SIZE = { width: 1080, height: 1350 } as const
export const ORACLE_SHARE_LAYOUT = { margin: 64, metricTop: 450, chartTitle: 680, chartTop: 780, chartBaseline: 1060, footerTop: 1144 } as const
export async function renderOracleSharePng(snapshot: OracleShareSnapshot): Promise<Blob> {
  await document.fonts?.ready
  const style = getComputedStyle(document.documentElement)
  const token = (name: string) => { const value = style.getPropertyValue(name).trim(); if (!value) throw new Error("SHARE_THEME_UNAVAILABLE"); return value }
  const canvas = document.createElement("canvas")
  canvas.width = ORACLE_SHARE_SIZE.width; canvas.height = ORACLE_SHARE_SIZE.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("SHARE_CANVAS_UNAVAILABLE")
  const font = token("--sans"), ink = token("--ink"), secondary = token("--ink-3"), brand = token("--brand")
  ctx.fillStyle = token("--surface"); ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textBaseline = "top"
  function text(value: string, x: number, y: number, size: number, weight: number, width = 952, color = ink): number {
    ctx!.font = `${weight} ${size}px ${font}`; ctx!.fillStyle = color
    const lines = wrapMemoText(value, width, value => ctx!.measureText(value).width)
    for (const line of lines) { ctx!.fillText(line, x, y); y += size * 1.35 }
    return y
  }
  text("TRAINORACLE", 64, 64, 28, 700, 952, brand)
  text(snapshot.source, 64, 124, 27, 600, 952, secondary)
  text(snapshot.period, 64, 174, 27, 500, 952, secondary)
  const headlineBottom = text(snapshot.headline, 64, 258, 64, 750)
  if (headlineBottom > 435) throw new Error("SHARE_HEADLINE_OVERFLOW")
  const metrics = snapshot.metrics, gap = 30, column = (952 - (metrics.length - 1) * gap) / Math.max(metrics.length, 1)
  metrics.forEach((metric, index) => {
    const x = 64 + index * (column + gap)
    text(metric.label, x, ORACLE_SHARE_LAYOUT.metricTop, 25, 500, column, secondary)
    const valueSize = metric.text.length > 12 ? 38 : 58
    const bottom = text(metric.text, x, 538, valueSize, 750, column)
    if (bottom > 654) throw new Error("SHARE_METRIC_OVERFLOW")
    if (metric.label === "같은 종목 경기 기록 변화") text("최근 − 이전 기록", x, 620, 22, 500, column, secondary)
  })
  if (snapshot.months.length) {
    text("월별 누적 거리", 64, ORACLE_SHARE_LAYOUT.chartTitle, 32, 700)
    const max = Math.max(1, ...snapshot.months.map(month => month.km ?? 0))
    const slot = 952 / snapshot.months.length, barWidth = Math.min(120, slot * .6)
    snapshot.months.forEach((month, index) => {
      const x = 64 + slot * index, barX = x + (slot - barWidth) / 2
      const height = month.km === null ? 0 : (ORACLE_SHARE_LAYOUT.chartBaseline - ORACLE_SHARE_LAYOUT.chartTop) * month.km / max
      ctx.fillStyle = brand
      if (month.km !== null && height > 0) ctx.fillRect(barX, ORACLE_SHARE_LAYOUT.chartBaseline - height, barWidth, height)
      text(shareKm(month.km), x + 5, ORACLE_SHARE_LAYOUT.chartBaseline - height - 46, 25, 700, slot - 10)
      text(`${Number(month.label.slice(5))}월`, x + (slot - 80) / 2, 1090, 27, 600, 100, secondary)
    })
  }
  let y = ORACLE_SHARE_LAYOUT.footerTop
  for (const line of snapshot.limitations) y = text(line, 64, y, 24, 500, 952, secondary) + 5
  if (y > 1310) throw new Error("SHARE_CONTENT_OVERFLOW")
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("SHARE_PNG_FAILED")), "image/png"))
}
