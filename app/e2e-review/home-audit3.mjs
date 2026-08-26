import { chromium } from "@playwright/test"
const BASE = "http://localhost:4173/"
const RECORDS = JSON.stringify([{
  schemaVersion: 1, id: "pb-5k", purpose: "PERSONAL_BEST", eventDistanceM: 5000,
  performanceSeconds: 1111, achievedOn: "2026-08-10", seasonId: null,
  enteredBy: "ATHLETE", verificationState: "SELF_REPORTED",
  sourceRef: "athlete-record:pb-5k", savedAt: "2026-08-10T12:00:00.000Z",
}])
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } })
const page = await ctx.newPage()
await page.goto(BASE)
await page.evaluate((r) => localStorage.setItem("trainoracle.athlete-records.v1", r), RECORDS)
await page.reload()
await page.waitForTimeout(600)
// plan intake flow
await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()
await page.getByRole("button", { name: /5km/u }).click()
await page.getByRole("button", { name: /일반부/u }).click()
await page.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }).click()
await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
await page.getByRole("button", { name: "내 계획 완성하기" }).click()
await page.getByRole("button", { name: /반복 인터벌.*VO2/u }).click()
await page.getByRole("button", { name: /^3일/u }).click()
await page.getByRole("button", { name: /9일 계획 받기/u }).click()
await page.getByRole("button", { name: /아침에 운동해요/u }).click()
await page.getByRole("button", { name: /하루 한 번 운동/u }).click()
const picker = page.getByRole("region", { name: "개인 페이스 기준 기록" })
await picker.getByRole("button", { name: /개인 최고/u }).click()
await picker.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
await page.getByRole("button", { name: /반복 인터벌 포함 선택하기/u }).click()
await page.waitForTimeout(500)
// back to home
await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈" }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: "e2e-review/home-audit/03-with-plan-top.png" })
await page.evaluate(() => {
  const el = document.querySelector(".app-scroll-region")
  el.scrollTop = el.scrollHeight / 3
})
await page.waitForTimeout(300)
await page.screenshot({ path: "e2e-review/home-audit/03-with-plan-mid.png" })
// 더보기 screen
await page.getByRole("button", { name: "더보기" }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: "e2e-review/home-audit/04-more-screen.png" })
await browser.close()
console.log("DONE")
