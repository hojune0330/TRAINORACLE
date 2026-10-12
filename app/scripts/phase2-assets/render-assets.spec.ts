/**
 * Renders phase-2 assets to PNG (1x and 2x) and builds the contact sheet.
 *   npx playwright test --config scripts/phase2-assets/playwright.assets.config.ts
 * Portraits come from the live game rig (src/screens/treadmill/anime-runner.ts), so in-game sprites and
 * portraits always match. Output: public/phase2/**.png and docs/phase2/assets-contact-sheet.png.
 */
import { test } from "@playwright/test"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const PUBLIC = join(process.cwd(), "public/phase2")
const SHEET = join(process.cwd(), "../docs/phase2/assets-contact-sheet.png")
const svgs = JSON.parse(readFileSync(join(process.cwd(), "scripts/phase2-assets/manifest.json"), "utf8")) as string[]

test("export PNGs, portraits and contact sheet", async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto("/?app=1")
  // Wait for Pretendard so stamp/emblem lettering renders with the real font.
  await page.evaluate(() => document.fonts.ready)

  const rasterize = async (svgPath: string, scale: number) => page.evaluate(async ({ url, scale }) => {
    const img = new Image(); img.src = url
    await img.decode()
    const canvas = document.createElement("canvas")
    canvas.width = img.naturalWidth * scale; canvas.height = img.naturalHeight * scale
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/png").split(",")[1]!
  }, { url: `/phase2/${svgPath}`, scale })

  for (const path of svgs) {
    for (const scale of [1, 2]) {
      const file = join(PUBLIC, path.replace(/\.svg$/u, scale === 1 ? ".png" : "@2x.png"))
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, Buffer.from(await rasterize(path, scale), "base64"))
    }
  }

  // Portraits: 320×320 (2x of the 160px spec), cheer pose, on the character's card colour.
  const portraits = await page.evaluate(async () => {
    const sprites = await import("/src/screens/treadmill/sprites.ts")
    const palette = sprites.gamePalette(document.documentElement)
    const chars = ["tori", "hana", "dandan", "nabi", "r01", "pengu"] as const
    const backs: Record<string, string> = { tori: palette.skyLow, hana: palette.petal, dandan: palette.mudSkyLow, nabi: palette.catLight, r01: palette.robotLight, pengu: palette.seaLight }
    const out: Record<string, string> = {}
    for (const character of chars) {
      const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 320
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = backs[character]!; ctx.beginPath(); ctx.arc(160, 160, 156, 0, Math.PI * 2); ctx.fill()
      ctx.lineWidth = 8; ctx.strokeStyle = palette.outline; ctx.stroke()
      ctx.save(); ctx.beginPath(); ctx.arc(160, 160, 152, 0, Math.PI * 2); ctx.clip()
      // Bust crop: scale the 66px rig so the head fills the upper half.
      ctx.translate(152, 420); ctx.scale(4.6, 4.6)
      sprites.drawRunner(ctx, palette, { pose: "idle", phase: 0, upgrades: [], character })
      ctx.restore()
      out[character] = canvas.toDataURL("image/png").split(",")[1]!
    }
    return out
  })
  for (const [id, data] of Object.entries(portraits)) {
    const file = join(PUBLIC, `portraits/portrait-${id}@2x.png`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, Buffer.from(data, "base64"))
  }

  // Contact sheet.
  await page.setViewportSize({ width: 1200, height: 1300 })
  await page.evaluate(({ svgs, portraits }) => {
    document.body.innerHTML = ""
    document.body.style.cssText = "margin:0;background:#F4F3EE;font-family:'Pretendard Variable',sans-serif"
    const groups = new Map<string, string[]>()
    for (const path of svgs) { const dir = path.split("/")[0]!; groups.set(dir, [...(groups.get(dir) ?? []), path]) }
    const title = (text: string) => `<h2 style="margin:18px 24px 8px;font-size:15px;color:#2B3330">${text}</h2>`
    const cell = (src: string, label: string, size: number) => `<figure style="margin:0;display:grid;justify-items:center;gap:4px;width:${Math.max(size, 96) + 16}px"><img src="${src}" width="${size}" height="${size}" alt=""><figcaption style="font-size:11px;color:#5F6965;text-align:center">${label}</figcaption></figure>`
    const sizes: Record<string, number> = { currency: 64, icons: 32, trails: 96, stamps: 112, seasons: 160, illustrations: 128 }
    let html = `<h1 style="margin:20px 24px 0;font-size:20px">TrainOracle 2차 에셋 컨택트 시트 · 2026-10-09</h1>`
    for (const [dir, list] of groups) {
      html += title(dir) + `<div style="display:flex;flex-wrap:wrap;gap:12px;padding:0 24px">${list.map(p => cell(`/phase2/${p}`, p.split("/")[1]!.replace(".svg", ""), sizes[dir] ?? 64)).join("")}</div>`
    }
    html += title("portraits (게임 리그에서 렌더)") + `<div style="display:flex;flex-wrap:wrap;gap:12px;padding:0 24px">${Object.entries(portraits).map(([id, data]) => cell(`data:image/png;base64,${data}`, `portrait-${id}`, 128)).join("")}</div>`
    document.body.innerHTML = html
  }, { svgs, portraits })
  await page.waitForLoadState("networkidle")
  await page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => undefined))))
  mkdirSync(dirname(SHEET), { recursive: true })
  await page.screenshot({ path: SHEET, fullPage: true })
})
