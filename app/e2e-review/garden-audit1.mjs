import { chromium } from "playwright"
const BASE = "http://127.0.0.1:4173/"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 667 } })
const shot = (n) => page.screenshot({ path: `e2e-review/garden/${n}.png`, fullPage: false })

// 1) 실제 UI로 일지 1건 저장 → JOURNAL 모드 진입
await page.goto(BASE); await page.waitForTimeout(700)
await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
await page.getByRole("heading", { name: "훈련 후 · 기록" }).waitFor()
await page.getByRole("button", { name: /^저장/u }).click()
await page.waitForTimeout(1200)

// 포인트 부스팅: engagement 원장에 과거 일지일을 직접 주입하는 대신
// 실제 방문확인 클릭 + localStorage의 원장 구조 확인
const ledger = await page.evaluate(() => localStorage.getItem("trainoracle.engagement.v2"))
console.log("LEDGER:", ledger)

// 2) 홈 하단 engagement strip + 꾸미기 섹션 측정
await page.getByRole("button", { name: "홈" }).click(); await page.waitForTimeout(700)
const strip = await page.evaluate(() => {
  const s = document.querySelector(".engagement-strip")
  const shop = document.querySelector(".decoration-shop")
  const r = s?.getBoundingClientRect(); const r2 = shop?.getBoundingClientRect()
  return {
    stripTop: r ? Math.round(r.top) : null, stripH: r ? Math.round(r.height) : null,
    shopTop: r2 ? Math.round(r2.top) : null, shopH: r2 ? Math.round(r2.height) : null,
    stripText: s?.textContent?.slice(0, 300) ?? null,
  }
})
console.log("STRIP:", JSON.stringify(strip))
// 스크롤해서 strip 위치로
await page.evaluate(() => document.querySelector(".engagement-strip")?.scrollIntoView())
await page.waitForTimeout(400); await shot("01-strip")
// 방문 확인 클릭
const visit = page.getByRole("button", { name: /오늘 방문 확인/u })
if (await visit.count() > 0) { await visit.click(); await page.waitForTimeout(500) }
await shot("02-strip-after-visit")
// 꾸미기 섹션으로 스크롤
await page.evaluate(() => document.querySelector(".decoration-shop")?.scrollIntoView())
await page.waitForTimeout(400); await shot("03-shop-closed")
// 꾸미기 열기
await page.getByRole("button", { name: "꾸미기 열기" }).click()
await page.waitForTimeout(600)
await page.evaluate(() => document.querySelector(".decoration-shop")?.scrollIntoView())
await shot("04-studio-open-top")
const studioInfo = await page.evaluate(() => {
  const studio = document.querySelector(".decoration-studio")
  const tabs = [...document.querySelectorAll(".decoration-studio__situation-tabs button")].map(b=>b.textContent.trim())
  const filters = [...document.querySelectorAll(".decoration-studio__type-filter button")].map(b=>b.textContent.trim())
  const items = [...document.querySelectorAll(".decoration-shop__item")].length
  const h = studio ? Math.round(studio.getBoundingClientRect().height) : null
  const tabsEl = document.querySelector(".decoration-studio__situation-tabs")
  const tabsOverflow = tabsEl ? tabsEl.scrollWidth > tabsEl.clientWidth : null
  return { tabs, filters, items, studioH: h, tabsOverflow }
})
console.log("STUDIO:", JSON.stringify(studioInfo))
// 프리뷰 카드 영역
await page.evaluate(() => document.querySelector(".decoration-studio-preview")?.scrollIntoView())
await page.waitForTimeout(300); await shot("05-preview-card")
// 아이템 목록으로 스크롤
await page.evaluate(() => document.querySelector(".decoration-shop__items")?.scrollIntoView())
await page.waitForTimeout(300); await shot("06-items")
// 각 아이템 카드의 높이/버튼 측정
const itemMetrics = await page.evaluate(() => {
  return [...document.querySelectorAll(".decoration-shop__item")].slice(0,8).map(el => {
    const name = el.querySelector("strong")?.textContent
    const btns = [...el.querySelectorAll("button")].map(b => ({ t: b.textContent.trim().slice(0,12), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }))
    return { name, h: Math.round(el.getBoundingClientRect().height), btns }
  })
})
console.log("ITEMS:", JSON.stringify(itemMetrics))
await browser.close()
