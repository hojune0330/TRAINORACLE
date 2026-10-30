import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block", contextOptions: { reducedMotion: "reduce" } })
test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
})

for (const [event, minutes, seconds] of [
  ["800m", 2, 1.5], ["1500m", 4, 30], ["3000m", 10, 0], ["5km", 20, 0],
  ["10km", 40, 0], ["하프 마라톤", 90, 0], ["마라톤", 180, 0],
] as const) {
  test(`${event}: actual intake, explicit pace application and local reload`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto("/?app=1")
    await page.getByRole("button", { name: "훈련 계획 만들기", exact: true }).click()
    await page.getByRole("button", { name: event, exact: true }).click()
    await page.getByRole("button", { name: /내 기록/ }).first().click()
    await page.getByLabel("분", { exact: true }).fill(String(minutes))
    await page.getByLabel("초", { exact: true }).fill(String(seconds))
    await page.getByText("기록 날짜 추가", { exact: true }).click()
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    await page.getByLabel("기록 달성일").fill(yesterday)
    await page.getByRole("button", { name: "기록 저장하고 계속", exact: true }).click()
    await page.getByRole("button", { name: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/ }).press("Enter")
    await page.getByRole("button", { name: /^매일/ }).press("Enter")
    await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ }).press("Enter")
    await expect(page.getByRole("heading", { name: "계획이 준비됐어요", exact: true })).toBeVisible()
    if (["10km", "하프 마라톤", "마라톤"].includes(event)) {
      await page.getByRole("button", { name: "이 페이스로 계획안에 적용", exact: true }).click()
    } else {
      await page.getByRole("button", { name: "기준 기록 확인하기", exact: true }).click()
      const recommended = page.getByRole("button", { name: /추천.*최근/ })
      if (await recommended.count()) await recommended.first().click()
      await page.getByRole("button", { name: "이 기록으로 개인 페이스 적용", exact: true }).click()
    }
    await expect(page.locator(".plan-candidate-overview")).not.toContainText("상세 구성 미정")
    const start = page.getByRole("button", { name: "이 일정으로 시작", exact: true })
    await expect(start).toBeEnabled()
    await start.click()
    await expect.poll(() => page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).not.toBeNull()
    const original = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
    await page.reload()
    await page.getByRole("navigation", { name: "주 탭", exact: true }).getByRole("button", { name: "훈련", exact: true }).click()
    await expect(page.getByRole("button", { name: "이 훈련 일지 쓰기", exact: true }).first()).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(original)
  })
}

test("compact first recommendation remains readable at narrow widths and text zoom", async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: "훈련 계획 만들기", exact: true }).click()
  await page.getByRole("button", { name: "5km", exact: true }).click()
  await page.getByRole("button", { name: /기록 없이/ }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/ }).press("Enter")
  await page.getByRole("button", { name: "3일", exact: true }).press("Enter")
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ }).press("Enter")
  const start = page.getByRole("button", { name: "이 일정으로 시작", exact: true })
  await expect(start).toBeEnabled()
  const box = await start.boundingBox()
  expect(box!.y + box!.height).toBeLessThan(720)
  await expect(page.getByText("다른 계획 보기", { exact: true })).toBeVisible()
  for (const width of [320, 360, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    const overview = page.locator(".plan-candidate-overview")
    expect(await overview.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: info.outputPath(`first-plan-${width}.png`) })
  }
  await page.setViewportSize({ width: 320, height: 800 })
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
  expect(await page.locator(".plan-candidate-overview").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
})
