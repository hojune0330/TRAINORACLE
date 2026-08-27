import { chromium } from "playwright"
const BASE = "http://127.0.0.1:4173/"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 667 } })
const shot = (n) => page.screenshot({ path: `e2e-review/garden/${n}.png` })

// 일지 저장 + 방문확인으로 5P 확보 시도 (4P 일지일 + 1P 방문)
await page.goto(BASE); await page.waitForTimeout(700)
await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
await page.getByRole("heading", { name: "훈련 후 · 기록" }).waitFor()
await page.getByRole("button", { name: /^저장/u }).click()
await page.waitForTimeout(1200)
await page.getByRole("button", { name: "홈" }).click(); await page.waitForTimeout(800)
const visit = page.getByRole("button", { name: /오늘 방문 확인/u })
if (await visit.count() > 0) { await visit.click(); await page.waitForTimeout(600) }
const pts = await page.evaluate(() => document.querySelector(".engagement-strip")?.textContent?.match(/사용 가능\s*(\d+)P/)?.[1] ?? document.querySelector(".decoration-shop h3")?.textContent)
console.log("POINTS:", pts)
const ledger = await page.evaluate(() => localStorage.getItem("trainoracle.engagement.v2"))
console.log("LEDGER:", ledger?.slice(0,200))

// 꾸미기 열고 스티커 구매 시도 (결승선 8P — 5P뿐이면 부족 메시지 확인)
await page.getByRole("button", { name: "꾸미기 열기" }).click(); await page.waitForTimeout(600)
const buyBtn = page.getByRole("button", { name: /결승선 스티커 8P로 받기/u })
await buyBtn.scrollIntoViewIfNeeded(); await buyBtn.click(); await page.waitForTimeout(500)
const notice1 = await page.evaluate(() => document.querySelector(".decoration-shop [role=status]")?.textContent)
console.log("BUY-NOTICE(부족예상):", notice1)
await shot("07-buy-insufficient")

// 포인트를 충분히 만들기 위해 원장에 과거 일지일 주입 (스키마 확인 후)
const seeded = await page.evaluate(() => {
  const raw = localStorage.getItem("trainoracle.engagement.v2")
  if (!raw) return "no-ledger"
  const data = JSON.parse(raw)
  return JSON.stringify(Object.keys(data)) + " || " + raw.slice(0, 300)
})
console.log("LEDGER-SHAPE:", seeded)
await browser.close()
