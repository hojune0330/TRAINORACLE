import { chromium } from "playwright"
const BASE = "http://127.0.0.1:4173/"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 667 } })
const shot = (n) => page.screenshot({ path: `e2e-review/garden/${n}.png`, fullPage: false })
const notice = () => page.evaluate(() => document.querySelector(".decoration-shop [role=status]")?.textContent ?? "")

// 0) 초기화 + 포인트 시드(과거 일지일 5개 = 20P + 오늘 방문 1P = 21P)
await page.goto(BASE); await page.waitForTimeout(600)
await page.evaluate(() => {
  localStorage.clear()
  const today = new Date().toISOString().slice(0, 10)
  localStorage.setItem("trainoracle.engagement.v2", JSON.stringify({
    version: 2,
    visitDates: [today],
    journalDates: ["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24"],
    pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
  }))
})
await page.reload(); await page.waitForTimeout(800)

// 1) 오늘 일지 저장(배치 가드 통과용 실제 기록)
await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
await page.getByRole("heading", { name: "훈련 후 · 기록" }).waitFor()
// 제목 채워서 참여 자격도 확보 시도
const title = page.getByLabel(/제목/u).first()
if (await title.count() > 0) await title.fill("가볍게 조깅")
await page.getByRole("button", { name: /^저장/u }).click()
await page.waitForTimeout(1000)
await page.getByRole("button", { name: "홈" }).click(); await page.waitForTimeout(800)
console.log("LEDGER-AFTER-SAVE:", await page.evaluate(() => localStorage.getItem("trainoracle.engagement.v2")))

// 2) 꾸미기 열고 결승선 스티커(8P) 구매
await page.getByRole("button", { name: "꾸미기 열기" }).click(); await page.waitForTimeout(500)
const buyBtn = page.getByRole("button", { name: /결승선 스티커 8P로 받기/u })
await buyBtn.scrollIntoViewIfNeeded(); await buyBtn.click(); await page.waitForTimeout(500)
console.log("BUY-NOTICE:", await notice())
await shot("08-after-buy")

// 3) 오늘 날짜에 결승선 스티커 사용(배치)
const useBtn = page.getByRole("button", { name: /결승선 스티커.*사용/u }).first()
if (await useBtn.count() > 0) {
  await useBtn.scrollIntoViewIfNeeded(); await useBtn.click(); await page.waitForTimeout(500)
  // 교체 다이얼로그 여부
  const dialog = page.locator("dialog[open], [role=dialog]")
  if (await dialog.count() > 0) {
    console.log("DIALOG-ON-FIRST-USE:", await dialog.first().textContent())
    await page.getByRole("button", { name: /교체하기|바꾸기/u }).click(); await page.waitForTimeout(400)
  }
  console.log("USE-NOTICE:", await notice())
} else {
  console.log("USE-BTN-NOT-FOUND; buttons:", await page.locator(".decoration-shop__item-actions button").allTextContents())
}
console.log("DECOR-STATE:", (await page.evaluate(() => localStorage.getItem("trainoracle.decorations.v1") ?? Object.keys(localStorage).join(","))))
await shot("09-after-place")

// 4) 실제 일지 페이지에서 렌더 확인
await page.getByRole("button", { name: "일지", exact: true }).click(); await page.waitForTimeout(900)
await shot("10-journal-tab")
// 월 목록 → 2026년 8월 진입 → 오늘(27일) 항목 열기
const month = page.getByText(/2026년 8월/u).first()
if (await month.count() > 0) { await month.click(); await page.waitForTimeout(800) }
await shot("10b-month-view")
const dayLink = page.getByText(/27/u).first()
console.log("DAY-CANDIDATES:", await page.locator("main button, main a, main article").allTextContents().then((t) => JSON.stringify(t.slice(0, 12))))
if (await dayLink.count() > 0) { await dayLink.click().catch(() => {}); await page.waitForTimeout(900) }
const slotIds = await page.evaluate(() => [...document.querySelectorAll("[data-testid^=journal-slot], [data-testid=journal-page-theme], [data-testid=journal-page-avatar]")].map((el) => el.getAttribute("data-testid")))
console.log("RENDERED-SLOTS:", JSON.stringify(slotIds))
await shot("11-journal-detail")

// 5) 일지 화면 꾸미기 툴바 열기
const launch = page.getByRole("button", { name: "일지 꾸미기 열기" })
if (await launch.count() > 0) {
  await launch.first().scrollIntoViewIfNeeded()
  await launch.first().click(); await page.waitForTimeout(500)
  await shot("12-journal-toolbar")
  const tbItems = await page.locator(".journal-decoration-toolbar__items article").count()
  console.log("TOOLBAR-ITEMS:", tbItems)
  // 맑은날 스티커 사용 → 같은 슬롯이면 교체 다이얼로그 기대
  const sunUse = page.getByRole("button", { name: /맑은 날.*사용$/u })
  console.log("SUN-USE-COUNT:", await sunUse.count())
  if (await sunUse.count() > 0) {
    await sunUse.first().click(); await page.waitForTimeout(500)
    const dlg = page.locator("[role=dialog], dialog[open]")
    if (await dlg.count() > 0) {
      console.log("REPLACE-DIALOG:", (await dlg.first().textContent())?.slice(0, 120))
      await shot("13-replace-dialog")
      await page.getByRole("button", { name: "교체하기" }).click(); await page.waitForTimeout(500)
    }
    console.log("TOOLBAR-NOTICE:", await page.evaluate(() => document.querySelector(".journal-decoration-toolbar [role=status]")?.textContent))
  }
  // 제거
  const rm = page.getByRole("button", { name: /맑은 날 제거/u })
  if (await rm.count() > 0) { await rm.first().click(); await page.waitForTimeout(500); console.log("REMOVE-NOTICE:", await page.evaluate(() => document.querySelector(".journal-decoration-toolbar [role=status]")?.textContent)) }
  await shot("14-after-remove")
} else {
  console.log("NO-TOOLBAR-LAUNCH on this screen")
}
console.log("FINAL-DECOR:", (await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.includes("decoration")) return k + " => " + localStorage.getItem(k); return "none" })))
await browser.close()
