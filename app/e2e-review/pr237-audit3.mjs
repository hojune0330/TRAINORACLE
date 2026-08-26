import { chromium } from "playwright"
const BASE = "http://127.0.0.1:4173/"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 667 } })
const shot = (n) => page.screenshot({ path: `e2e-review/pr237/${n}.png` })

// 상태 재구성: 첫 저장 + 계획 채택 (localStorage는 컨텍스트별 초기화라 다시 수행)
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
const bodyText = await page.evaluate(() => document.body.textContent)
console.log("plan saved?", bodyText.includes("내 훈련 일정"))

// 홈 탭으로 이동
await page.getByRole("button", { name: "홈" }).click()
await page.waitForTimeout(800)
const foldB = await page.evaluate(() => {
  const secs = [...document.querySelectorAll("section")].map((s) => s.className.split(" ")[0]).slice(0, 5)
  const next = document.querySelector(".training-home__next")
  const nextBottom = next ? Math.round(next.getBoundingClientRect().bottom) : null
  const vh = document.querySelector(".app-scroll-region")?.clientHeight ?? 0
  return { secs, nextBottom, vh, nextText: next?.textContent?.slice(0, 80) ?? null }
})
console.log("MODE B HOME:", JSON.stringify(foldB))
await shot("B-training-home-fold")
await browser.close()
