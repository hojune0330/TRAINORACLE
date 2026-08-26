import { chromium } from "playwright"
const BASE = "http://127.0.0.1:4173/"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 667 } })
const shot = (n) => page.screenshot({ path: `e2e-review/pr237/${n}.png` })

await page.goto(BASE); await page.waitForTimeout(700)
await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
await page.getByRole("heading", { name: "훈련 후 · 기록" }).waitFor()
await page.getByRole("button", { name: /^저장/u }).click()
await page.waitForTimeout(1000)
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
await page.waitForTimeout(900)
await shot("B-step-after-once")
// 다음 단계 버튼 후보 출력
const buttons = await page.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.textContent.trim().slice(0, 40)).filter(Boolean))
console.log("BUTTONS:", JSON.stringify(buttons))
// 페이스 적용 단계가 있으면 통과 시도
const skipPace = page.getByRole("button", { name: /기록 없이|건너|적용하지 않|이대로/u }).first()
if (await skipPace.count() > 0) { console.log("skip-pace label:", await skipPace.textContent()); await skipPace.click(); await page.waitForTimeout(700) }
const adopt2 = page.getByRole("button", { name: /선택하기|시작하기|이 계획/u }).first()
if (await adopt2.count() > 0) { console.log("adopt label:", await adopt2.textContent()); await adopt2.click(); await page.waitForTimeout(900) }
await shot("B-step-final")
console.log("FINAL TEXT:", (await page.evaluate(() => document.body.textContent.slice(0, 150))))
// 홈으로
await page.getByRole("button", { name: "홈" }).click(); await page.waitForTimeout(800)
const foldB = await page.evaluate(() => {
  const secs = [...document.querySelectorAll("section")].map((s) => s.className.split(" ")[0]).slice(0, 5)
  const next = document.querySelector(".training-home__next")
  return { secs, nextBottom: next ? Math.round(next.getBoundingClientRect().bottom) : null, vh: document.querySelector(".app-scroll-region")?.clientHeight ?? 0, nextText: next?.textContent?.slice(0, 90) ?? null }
})
console.log("MODE B HOME:", JSON.stringify(foldB))
await shot("B-training-home-fold")
await browser.close()
