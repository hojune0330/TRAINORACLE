import { expect, test } from "@playwright/test"
import { expectNoHorizontalOverflow, seedTouchAuditEntries } from "./touch-audit"

test.use({ serviceWorkers: "block" })

test("keeps compact navigation visible without shrinking its touch target", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")

  const navigation = page.getByRole("navigation", { name: "주 탭" })
  const home = navigation.getByRole("button", { name: "홈" })
  const icon = home.locator("svg")

  await expect(navigation).toBeVisible()
  await expect(home).toHaveCSS("min-height", "44px")
  await expect(icon).toHaveCSS("width", "20px")
  await expect(icon).toHaveCSS("height", "20px")
  const activeFace = await home.evaluate(element => {
    const style = getComputedStyle(element, "::before")
    return { radius: style.borderRadius, background: style.backgroundColor }
  })
  expect(activeFace.radius).toBe("12px")
  expect(activeFace.background).not.toBe("rgba(0, 0, 0, 0)")
  await expectNoHorizontalOverflow(page)
})

test("keeps analysis view tabs compact and touchable", async ({ page }) => {
  await seedTouchAuditEntries(page)
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "오라클" }).click()
  await page.locator(".trends-hub__detail-menu > summary").click()
  await page.getByRole("group", { name: "훈련 분석 자세히 보기" }).getByRole("button", { name: "월별 변화", exact: true }).click()

  const tabs = page.getByRole("group", { name: "추이 항목" }).getByRole("button")
  await expect(tabs).toHaveCount(4)

  for (const tab of await tabs.all()) {
    const box = await tab.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    const face = await tab.evaluate((element) => {
      const style = getComputedStyle(element, "::before")
      return { top: style.top, bottom: style.bottom, radius: style.borderRadius }
    })
    expect(face).toEqual({ top: "0px", bottom: "0px", radius: "12px" })
  }

  await expectNoHorizontalOverflow(page)
})

test("shared choices keep selection, keyboard operation and enlarged labels across sections", async ({ page }, info) => {
  await page.goto("/?app=1&uitest=1")
  const navigation = page.getByRole("navigation", { name: "주 탭" })
  await navigation.getByRole("button", { name: "일지", exact: true }).click()
  const cycle = page.getByRole("button", { name: "기록 묶음", exact: true })
  await cycle.focus()
  await page.keyboard.press("Enter")
  await expect(cycle).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "월간 달력", exact: true }).click()
  await expect(cycle).toHaveAttribute("aria-pressed", "false")

  await navigation.getByRole("button", { name: "오라클", exact: true }).click()
  const choices = page.getByRole("group", { name: "오라클 항목" }).getByRole("button")
  for (const choice of await choices.all()) {
    await expect(choice).toHaveCSS("border-radius", "12px")
    expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(page.getByRole("heading", { name: "내 훈련 살펴보기", exact: true })).toBeVisible()
  await expect(choices.first()).toBeVisible()
  await page.screenshot({ path: info.outputPath("rounded-oracle-default.png"), fullPage: true })
  // A larger user font must grow the face, not clip a fixed-height label.
  await page.addStyleTag({ content: '.app-choice-control, .app-compact-tab { font-size: 28px !important; }' })
  await expectNoHorizontalOverflow(page)
  for (const choice of await choices.all()) {
    expect(await choice.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath("rounded-oracle-large-text.png"), fullPage: true })
  await navigation.getByRole("button", { name: "홈", exact: true }).click()
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  const learning = page.getByRole("button", { name: "훈련법 읽기", exact: true })
  await expect(learning).toHaveCSS("border-radius", "12px")
  await expect(learning).not.toHaveAttribute("aria-pressed")
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: info.outputPath("rounded-more-large-text.png"), fullPage: true })
})
