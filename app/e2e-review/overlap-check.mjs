import { chromium } from "playwright"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 667 } })
await page.goto("http://127.0.0.1:4173/"); await page.waitForTimeout(500)
await page.evaluate(() => {
  localStorage.clear()
  const today = new Date().toISOString().slice(0, 10)
  localStorage.setItem("trainoracle.engagement.v2", JSON.stringify({ version: 2, visitDates: [today], journalDates: ["2026-08-20"], pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA" }))
  localStorage.setItem("trainoracle.decorations.v2", JSON.stringify({ version: 2, spentPoints: 8, ownedItemIds: ["THEME_TRACK_NOTEBOOK","INK_NAVY","STICKER_WEATHER_SUN","STAMP_REST_DAY","TAPE_CHECKER","STICKER_FINISH_LINE"], equipped: { themeId: "THEME_TRACK_NOTEBOOK", inkId: "INK_NAVY", avatarId: null }, library: { favoriteItemIds: [], recentItemIds: [] }, pagePlacements: [{ date: today, slot: "TOP_CORNER", itemId: "STICKER_FINISH_LINE" }, { date: today, slot: "PAGE_FOOTER", itemId: "STAMP_REST_DAY" }, { date: today, slot: "HEADER_TAPE", itemId: "TAPE_CHECKER" }], pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA" }))
})
await page.reload(); await page.waitForTimeout(600)
await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
await page.getByRole("heading", { name: "훈련 후 · 기록" }).waitFor()
await page.getByRole("button", { name: /^저장/u }).click(); await page.waitForTimeout(800)
await page.getByRole("button", { name: "일지", exact: true }).click(); await page.waitForTimeout(700)
await page.getByText(/2026년 8월/u).first().click(); await page.waitForTimeout(700)
await page.getByText(/27/u).first().click().catch(() => {}); await page.waitForTimeout(800)
// 각 슬롯 중앙 좌표에서 elementFromPoint로 실제 최상단 요소 확인
const res = await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll("[data-testid^=journal-slot]")) {
    const r = el.getBoundingClientRect()
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2
    void cx; void cy
    const cs = getComputedStyle(el)
    out.push({ slot: el.getAttribute("data-testid"), zIndex: cs.zIndex, pointerEvents: cs.pointerEvents })
  }
  return out
})
console.log(JSON.stringify(res, null, 1))
await page.screenshot({ path: "e2e-review/garden/20-overlap-after.png" })
await browser.close()
