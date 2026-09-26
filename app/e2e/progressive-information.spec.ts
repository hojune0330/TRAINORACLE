import { expect, test } from "@playwright/test"
import { enterPlanWithoutRecord } from "./plan-flow"

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    return url.hostname === "127.0.0.1" || url.hostname === "localhost"
      ? route.continue() : route.abort()
  })
  await page.goto("/?app=1&uitest=1")
  await expect(page.getByRole("button", { name: "오늘 기록 남기기", exact: true })).toBeVisible()
})

for (const width of [320, 375]) {
  test(`shows the primary action and plan entry without requiring a fixed first viewport at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 667 })
    await page.evaluate(() => document.fonts.ready)
    for (const name of ["오늘 기록 남기기", "훈련 계획 만들기"]) {
      const button = page.getByRole("button", { name, exact: true })
      await expect(button).toBeInViewport({ ratio: 1 })
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    await expect(page.getByText("모든 데이터는 이 기기에만 저장돼요.")).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`) })
    await page.getByRole("button", { name: "오늘 기록 남기기", exact: true }).click()
    await expect(page.locator(".quick-log__paper")).toHaveCount(0)
    for (const button of await page.locator(".quick-log__choices button").all()) {
      await expect(button).toBeInViewport({ ratio: 1 })
    }
    await page.screenshot({ path: testInfo.outputPath(`quick-${width}.png`) })
  })

  test(`shows seven event choices and puts previous answers in an editable summary at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 667 })
    await page.getByRole("button", { name: "훈련 계획 만들기", exact: true }).click()
    const choices = page.getByRole("combobox", { name: "종목" })
    await expect(choices.locator("option")).toHaveCount(8)
    await expect(choices).toBeInViewport({ ratio: 1 })
    const explanation = page.locator("details").filter({ has: page.locator("summary", { hasText: "기록 관리·훈련표 읽기" }) })
    await expect(explanation).not.toHaveAttribute("open")
    await page.screenshot({ path: testInfo.outputPath(`plan-${width}.png`) })
    await enterPlanWithoutRecord(page)
    const summary = page.locator(".plan-intake__summary")
    await expect(summary).toBeVisible()
    await summary.getByRole("button", { name: "1500m", exact: true }).click()
    await expect(page.getByRole("group", { name: "계획 종목 선택" })).toBeVisible()
    await expect(page.getByRole("group", { name: "계획 종목 선택" }).getByRole("button", { name: /^1500m\b/u })).toHaveAttribute("aria-pressed", "true")
  })
}

test("puts the first analysis action before optional explanation and opens help with the keyboard", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석", exact: true }).click()
  await expect(page.getByRole("button", { name: "첫 기록 남기기", exact: true })).toBeInViewport({ ratio: 1 })
  const summary = page.locator("summary", { hasText: "어떤 기록을 분석하나요?" })
  const help = summary.locator("..")
  await expect(help).not.toHaveAttribute("open")
  await page.screenshot({ path: testInfo.outputPath("analysis-empty.png") })
  await summary.focus()
  await page.keyboard.press("Enter")
  await expect(help).toHaveAttribute("open")
  await expect(page.getByRole("heading", { name: "내 훈련 요약", exact: true })).toBeVisible()
  await page.keyboard.press("Enter")
  await expect(help).not.toHaveAttribute("open")
})

test("keeps saved results visible and does not turn missing RPE into a value", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.getByRole("button", { name: "오늘 기록 남기기", exact: true }).click()
  await page.getByRole("button", { name: "운동을 마쳤어요", exact: true }).click()
  await expect(page.locator(".quick-log__summary-help")).not.toHaveAttribute("open")
  await page.getByRole("button", { name: "오전", exact: true }).click()
  await page.getByRole("button", { name: "모르겠어요 · RPE는 비워 둘게요", exact: true }).click()
  await page.getByRole("button", { name: "없어요", exact: true }).click()
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
  await expect(page.getByRole("heading", { name: "오늘 기록을 남겼어요.", exact: true })).toBeVisible()
  await expect(page.locator(".quick-log__stamp")).toBeVisible()
  expect(await page.locator(".quick-log__stamp").evaluate(el => el.closest("details") === null)).toBe(true)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.journal.v1") ?? "[]"))
  expect(saved).toHaveLength(1)
  expect(saved[0].fieldProvenance.rpe.provenance).toBe("MISSING")
  await page.screenshot({ path: testInfo.outputPath("quick-saved.png") })
  await page.getByRole("button", { name: "완료", exact: true }).click()
  await expect(page.getByText("오늘 기록을 남겼어요.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "기록 더 남기기", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "오늘 기록하기", exact: true })).toHaveCount(0)
})

test("keeps learning content and its application limits available without a developer introduction", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.getByRole("button", { name: "훈련 배우기", exact: true }).click()
  await expect(page.getByRole("heading", { name: "어떤 훈련이 궁금한가요?" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("learning.png") })
  await page.getByRole("button", { name: /크루즈 인터벌은 지속주와/u }).click()
  await expect(page.getByRole("heading", { name: "따라 하기 전에", exact: true })).toBeVisible()
  const source = page.locator("summary", { hasText: "자료 출처와 저장 안내" })
  await expect(source.locator("..")).not.toHaveAttribute("open")
  await source.click()
  await expect(page.getByRole("link", { name: /VDOT Threshold/u })).toBeVisible()
})

test("wraps text at double size without horizontal clipping and respects reduced motion", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter(el => !(el instanceof SVGElement) && getComputedStyle(el).fontSize)
    const sizes = nodes.map(el => parseFloat(getComputedStyle(el).fontSize))
    nodes.forEach((el, i) => el.style.setProperty("font-size", `${sizes[i]! * 2}px`, "important"))
  })
  expect(await page.locator(".app-scroll-region").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  for (const label of ["훈련 계획 만들기", "훈련 배우기", "일지 꾸미기"]) {
    const button = page.getByRole("button", { name: label, exact: true })
    expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath("home-double-text.png") })
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석", exact: true }).click()
  const summary = page.locator("summary", { hasText: "어떤 기록을 분석하나요?" })
  await expect(summary.locator(".info-disclosure__chevron")).toHaveCSS("transition-property", "none")
})
