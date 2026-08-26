// Fable review walkthrough — captures every screen an athlete sees while
// receiving a personalized prescription. Not part of CI.
import { chromium } from "@playwright/test"
import fs from "node:fs"

const BASE = process.env.BASE ?? "http://localhost:4173"
const OUT = new URL("./shots/", import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })

const records = [
  { d: 800, s: 120 },
  { d: 1500, s: 245 },
  { d: 3000, s: 610 },
  { d: 5000, s: 1105 },
].map(({ d, s }) => ({
  schemaVersion: 1,
  id: `review-${d}`,
  purpose: "RECENT_RESULT",
  eventDistanceM: d,
  performanceSeconds: s,
  achievedOn: "2026-08-10",
  seasonId: null,
  enteredBy: "ATHLETE",
  verificationState: "SELF_REPORTED",
  sourceRef: `athlete-record:review-${d}`,
  savedAt: "2026-08-10T12:00:00.000Z",
}))

const shots = []
let n = 0
async function snap(page, name) {
  n += 1
  const file = `${String(n).padStart(2, "0")}-${name}.png`
  await page.screenshot({ path: OUT + file, fullPage: true })
  shots.push(file)
  console.log("shot:", file)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, serviceWorkers: "block" })
const page = await ctx.newPage()
const errors = []
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
page.on("pageerror", (e) => errors.push(e.message))

await page.addInitScript((seed) => {
  window.localStorage.setItem("trainoracle.athlete-records.v1", JSON.stringify(seed))
}, records)

await page.goto(`${BASE}/?app=1`)
await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()
await snap(page, "goal-step")

await page.getByRole("button", { name: /800m.*1500m.*3000m/u }).click()
await snap(page, "division-step")
await page.getByRole("button", { name: /일반부/u }).click()
await snap(page, "experience-step")
await page.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }).click()
await snap(page, "safety-step")
await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
await snap(page, "preview-step")
await page.getByRole("button", { name: "내 계획 완성하기" }).click()
await snap(page, "focus-step")
await page.getByRole("button", { name: /반복 인터벌.*VO2/u }).click()
await snap(page, "days-step")
await page.getByRole("button", { name: /^3일/u }).click()
await snap(page, "frame-length-step")
await page.getByRole("button", { name: /9일 계획 받기/u }).click()
await snap(page, "training-time-step")
await page.getByRole("button", { name: /아침에 운동해요/u }).click()
await snap(page, "two-a-day-step")
await page.getByRole("button", { name: /하루 한 번 운동/u }).click()
await page.waitForTimeout(400)
await snap(page, "candidates-initial")

// scroll to record picker
const picker = page.getByRole("region", { name: "개인 페이스 기준 기록" })
await picker.scrollIntoViewIfNeeded()
await snap(page, "record-picker")

await picker.getByRole("button", { name: /800m/u }).click()
await page.waitForTimeout(200)
await snap(page, "record-selected-unconfirmed")

await picker.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
await page.waitForTimeout(300)
await snap(page, "record-confirmed-bound")

// expand candidate A schedule and look at the detailed session
await page.getByText(/10×200m @800m RP/u).first().scrollIntoViewIfNeeded()
await snap(page, "detailed-session-in-candidate")

await page.getByRole("button", { name: /반복 인터벌 포함 선택하기/u }).click()
await page.waitForTimeout(400)
await snap(page, "active-plan-top")

await page.getByText(/10×200m @800m RP/u).first().scrollIntoViewIfNeeded()
await snap(page, "active-plan-detailed-session")

// open the details disclosure inside detailed view
const det = page.locator(".plan-detailed-prescription details summary").first()
if (await det.count()) {
  await det.click()
  await page.waitForTimeout(200)
  await snap(page, "active-plan-detailed-open")
}

// execution check
await page.getByText("시작·다시 시작 전 확인").first().click()
await page.waitForTimeout(200)
await snap(page, "execution-check-open")
await page.getByRole("button", { name: "통증 없고 평소와 같음 · 시작 확인" }).click()
await page.waitForTimeout(300)
await snap(page, "execution-check-confirmed")

// horizontal overflow check
const overflow = await page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
}))
console.log("overflow:", JSON.stringify(overflow))
console.log("console errors:", JSON.stringify(errors))
await browser.close()
