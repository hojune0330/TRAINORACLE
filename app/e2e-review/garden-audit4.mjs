import { chromium } from "playwright"
const BASE = "http://127.0.0.1:4173/"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 667 } })
const shot = (n) => page.screenshot({ path: `e2e-review/garden/${n}.png` })

// 이전 실행 상태 이어받기 (localStorage는 브라우저 새 인스턴스라 초기화됨 → 다시 시드)
await page.goto(BASE); await page.waitForTimeout(500)
await page.evaluate(() => {
  localStorage.clear()
  const today = new Date().toISOString().slice(0, 10)
  localStorage.setItem("trainoracle.engagement.v2", JSON.stringify({
    version: 2, visitDates: [today],
    journalDates: ["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24"],
    pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
  }))
  localStorage.setItem("trainoracle.decorations.v2", JSON.stringify({
    version: 2, spentPoints: 8,
    ownedItemIds: ["THEME_TRACK_NOTEBOOK", "INK_NAVY", "STICKER_WEATHER_SUN", "STAMP_REST_DAY", "TAPE_CHECKER", "STICKER_FINISH_LINE"],
    equipped: { themeId: "THEME_TRACK_NOTEBOOK", inkId: "INK_NAVY", avatarId: null },
    library: { favoriteItemIds: [], recentItemIds: ["STICKER_FINISH_LINE"] },
    pagePlacements: [{ date: today, slot: "TOP_CORNER", itemId: "STICKER_FINISH_LINE" }],
    pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
  }))
})
await page.reload(); await page.waitForTimeout(700)
// 오늘 일지 저장 (hasEntries 확보)
await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
await page.getByRole("heading", { name: "훈련 후 · 기록" }).waitFor()
await page.getByRole("button", { name: /^저장/u }).click(); await page.waitForTimeout(900)

// 일지 상세로 이동
await page.getByRole("button", { name: "일지", exact: true }).click(); await page.waitForTimeout(800)
await page.getByText(/2026년 8월/u).first().click(); await page.waitForTimeout(800)
await page.getByText(/27/u).first().click().catch(() => {}); await page.waitForTimeout(900)

// 스티커 가시성: 슬롯 rect + 페이지 상단 캡처
const rects = await page.evaluate(() => {
  const out = {}
  for (const el of document.querySelectorAll("[data-testid^=journal-slot], [data-testid=journal-page-theme]")) {
    const r = el.getBoundingClientRect()
    out[el.getAttribute("data-testid")] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 }
  }
  const launch = document.querySelector(".journal-decoration-launch")
  if (launch) { const r = launch.getBoundingClientRect(); out.launch = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  return out
})
console.log("SLOT-RECTS:", JSON.stringify(rects))
await shot("15-sticker-visible")

// 툴바 열고 교체 → 제거 전체 사이클
await page.getByRole("button", { name: "일지 꾸미기 열기" }).first().click(); await page.waitForTimeout(500)
const sunUse = page.getByRole("button", { name: /맑은 날.*사용$/u }).first()
await sunUse.scrollIntoViewIfNeeded(); await sunUse.click(); await page.waitForTimeout(400)
const dlg = page.getByRole("alertdialog")
console.log("REPLACE-DIALOG:", (await dlg.count()) > 0 ? (await dlg.textContent())?.replace(/\s+/g, " ").slice(0, 110) : "NONE")
await page.getByRole("button", { name: "교체하기" }).click(); await page.waitForTimeout(500)
console.log("AFTER-REPLACE-NOTICE:", await page.evaluate(() => document.querySelector(".journal-decoration-toolbar [role=status]")?.textContent))
console.log("AFTER-REPLACE-PLACEMENT:", await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.decorations.v2")).pagePlacements))
await shot("16-after-replace")

// 되돌리기 버튼 확인
const undo = page.getByRole("button", { name: "꾸미기 되돌리기" })
console.log("UNDO-VISIBLE:", await undo.count())

// 제거
const rm = page.getByRole("button", { name: /맑은 날 제거/u }).first()
await rm.scrollIntoViewIfNeeded(); await rm.click(); await page.waitForTimeout(500)
console.log("AFTER-REMOVE-NOTICE:", await page.evaluate(() => document.querySelector(".journal-decoration-toolbar [role=status]")?.textContent))
console.log("AFTER-REMOVE-PLACEMENT:", await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.decorations.v2")).pagePlacements))
await shot("17-after-remove")

// 홈 스튜디오: 기록 없는 날(내일)으로 이동 후 배치 시도 → 가드 메시지
await page.getByRole("button", { name: "홈", exact: true }).click(); await page.waitForTimeout(700)
await page.getByRole("button", { name: "꾸미기 열기" }).click(); await page.waitForTimeout(500)
await page.getByTestId("decoration-date-next").click(); await page.waitForTimeout(400)
const useNext = page.getByRole("button", { name: /결승선 스티커.*사용/u }).first()
await useNext.scrollIntoViewIfNeeded(); await useNext.click(); await page.waitForTimeout(400)
console.log("GUARD-NOTICE:", await page.evaluate(() => document.querySelector(".decoration-shop [role=status]")?.textContent))
await shot("18-guard-no-entry")
await browser.close()
