import { chromium } from "@playwright/test"

const BASE = "http://localhost:4173/"
const SHOT = (n) => `e2e-review/home-audit/${n}.png`

const RECORDS = JSON.stringify([{
  schemaVersion: 1, id: "pb-5k", purpose: "PERSONAL_BEST", eventDistanceM: 5000,
  performanceSeconds: 1111, achievedOn: "2026-08-10", seasonId: null,
  enteredBy: "ATHLETE", verificationState: "SELF_REPORTED",
  sourceRef: "athlete-record:pb-5k", savedAt: "2026-08-10T12:00:00.000Z",
}])

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const page = await ctx.newPage()
  return { ctx, page }
}

async function fullScroll(page, name) {
  await page.screenshot({ path: SHOT(`${name}-top`), fullPage: false })
  await page.screenshot({ path: SHOT(`${name}-full`), fullPage: true })
}

const browser = await chromium.launch()

// 1. 완전 빈 상태 (첫 방문자)
{
  const { ctx, page } = await newPage(browser)
  await page.goto(BASE)
  await page.waitForTimeout(800)
  await fullScroll(page, "01-empty-first-visit")
  await ctx.close()
}

// 2. 기록만 있는 사용자 (일지 유저)
{
  const { ctx, page } = await newPage(browser)
  await page.goto(BASE)
  await page.evaluate((records) => {
    localStorage.setItem("trainoracle.athlete-records.v1", records)
  }, RECORDS)
  await page.reload()
  await page.waitForTimeout(800)
  await fullScroll(page, "02-records-only")
  await ctx.close()
}

// 3. 하단 탭/네비 구조 확인
{
  const { ctx, page } = await newPage(browser)
  await page.goto(BASE)
  await page.waitForTimeout(600)
  const nav = await page.getByRole("navigation").allTextContents()
  console.log("NAV:", JSON.stringify(nav))
  const headings = await page.getByRole("heading").allTextContents()
  console.log("HEADINGS:", JSON.stringify(headings))
  const buttons = await page.getByRole("button").allTextContents()
  console.log("BUTTONS:", JSON.stringify(buttons.slice(0, 25)))
  await ctx.close()
}

await browser.close()
console.log("DONE")
