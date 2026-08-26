import { chromium } from "playwright"
const BASE = "http://127.0.0.1:4173/"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 667 } })
const shot = (n) => page.screenshot({ path: `e2e-review/pr237/${n}.png` })
const scrollRegion = async (px) => {
  await page.evaluate((v) => { const el = document.querySelector(".app-scroll-region"); if (el) el.scrollTop = v }, px)
  await page.waitForTimeout(300)
}

// A→C 전환: 실제 UI 저장
await page.goto(BASE); await page.waitForTimeout(700)
await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
await page.getByRole("heading", { name: "훈련 후 · 기록" }).waitFor()
await page.getByRole("button", { name: /^저장/u }).click()
await page.waitForTimeout(1200)
const afterSave = await page.evaluate(() => ({
  h1: document.querySelector("h1")?.textContent,
  secs: [...document.querySelectorAll("section")].map((s) => s.className.split(" ")[0]).slice(0, 5),
  restBtn: [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "하루 마무리 기록하기"),
  welcomeGone: !document.body.textContent.includes("달리기 일지를 남기고"),
}))
console.log("AFTER FIRST SAVE (mode C):", JSON.stringify(afterSave))
await shot("C-after-first-save-fold")
await scrollRegion(2000); await shot("C-after-first-save-mid")

// 모드 B: 계획 생성 (최소 인테이크)
await scrollRegion(0)
await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
await page.getByRole("button", { name: /5km/u }).click()
await page.getByRole("button", { name: /일반부/u }).click()
await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
await page.getByRole("button", { name: "내 계획 완성하기" }).click()
await page.getByRole("button", { name: /반복 인터벌.*VO2/u }).click()
await page.getByRole("button", { name: /^3일/u }).click()
await page.getByRole("button", { name: /9일 계획 받기/u }).click()
await page.getByRole("button", { name: /아침/u }).click()
await page.getByRole("button", { name: /하루 한 번/u }).click()
await page.waitForTimeout(800)
// 후보 선택 화면에서 첫 후보 채택
const adopt = page.getByRole("button", { name: /이 계획으로 시작|계획 시작|이 계획 선택/u }).first()
if (await adopt.count() > 0) { await adopt.click(); await page.waitForTimeout(600) }
else {
  // 후보 카드 선택 → 확정 버튼 탐색
  const candidate = page.locator("button", { hasText: /BALANCED|균형|후보/u }).first()
  if (await candidate.count() > 0) { await candidate.click(); await page.waitForTimeout(400) }
  const confirm = page.getByRole("button", { name: /시작|저장|선택/u }).first()
  if (await confirm.count() > 0) { await confirm.click(); await page.waitForTimeout(600) }
}
await shot("B-plan-flow-state")
console.log("PLAN SCREEN:", (await page.evaluate(() => document.body.textContent.slice(0, 200))))
await browser.close()
