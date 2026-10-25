import { expect, test } from "@playwright/test"
import { expectNoHorizontalOverflow, seedTouchAuditEntries } from "./touch-audit"

test.use({ serviceWorkers: "block" })

test("keeps compact navigation visible without shrinking its touch target", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")

  const navigation = page.getByRole("navigation", { name: "주 탭" })
  const home = navigation.getByRole("button", { name: "홈" })
  const icon = home.locator("svg")

  await expect(navigation).toBeVisible()
  await expect(home).toHaveCSS("min-height", "64px")
  await expect(icon).toHaveCSS("width", "22px")
  await expect(icon).toHaveCSS("height", "22px")
  const activeFace = await home.evaluate(element => {
    const style = getComputedStyle(element)
    return { radius: style.borderRadius, background: style.backgroundColor }
  })
  expect(activeFace.radius).toBe("12px")
  expect(activeFace.background).not.toBe("rgba(0, 0, 0, 0)")
  await expectNoHorizontalOverflow(page)
})

test("keeps analysis metric choices touchable and returns selection focus", async ({ page }) => {
  await seedTouchAuditEntries(page)
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "오라클" }).click()
  await page.getByRole("group", { name: "훈련 분석 자세히 보기" }).getByRole("button", { name: "월별 변화", exact: true }).click()

  const selector = page.getByRole("region", { name: "최근 4개월 추이" })
    .getByRole("button", { name: /^지표 선택:/u })
  await expect(selector).toBeVisible()
  await expect(selector).toHaveAttribute("aria-expanded", "false")
  expect((await selector.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await selector.click()
  const sheet = page.getByRole("dialog", { name: "볼 지표 선택" })
  const options = sheet.getByRole("group", { name: "추이 항목" }).getByRole("button")
  await expect(options).toHaveCount(4)
  await expect(selector).toHaveAttribute("aria-expanded", "true")

  for (const option of await options.all()) {
    const box = await option.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    await expect(option).toHaveCSS("border-radius", "12px")
  }
  const distance = sheet.getByRole("button", { name: "거리", exact: true })
  await expect(distance).toHaveAttribute("aria-pressed", "true")
  await expect(distance).toBeFocused()
  await expectNoHorizontalOverflow(page)

  await sheet.getByRole("button", { name: "페이스", exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await expect(selector).toHaveAccessibleName("지표 선택: 페이스")
  await expect(selector).toHaveAttribute("aria-expanded", "false")
  await expect(selector).toBeFocused()

  await selector.click()
  const pace = sheet.getByRole("button", { name: "페이스", exact: true })
  await expect(pace).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(sheet.getByRole("button", { name: "기분", exact: true })).toBeFocused()
  await expect(pace).toHaveAttribute("aria-pressed", "true")
  await page.keyboard.press("Escape")
  await expect(sheet).toHaveCount(0)
  await expect(selector).toHaveAccessibleName("지표 선택: 페이스")
  await expect(selector).toBeFocused()

  await expectNoHorizontalOverflow(page)
})

test("shared choices keep selection, keyboard operation and enlarged labels across sections", async ({ page }, info) => {
  await page.goto("/?app=1&uitest=1")
  const navigation = page.getByRole("navigation", { name: "주 탭" })
  await navigation.getByRole("button", { name: "일지", exact: true }).click()
  const cycle = page.getByRole("radio", { name: "기록 묶음", exact: true })
  await cycle.focus()
  // Radio options activate with Space; Enter is intentionally suppressed by Radix.
  await page.keyboard.press("Space")
  await expect(cycle).toHaveAttribute("aria-checked", "true")
  await page.getByRole("radio", { name: "월간 달력", exact: true }).click()
  await expect(cycle).toHaveAttribute("aria-checked", "false")

  await page.getByRole("navigation", { name: "일지 메뉴" }).getByRole("button", { name: "일지 나가기" }).click()
  await navigation.getByRole("button", { name: "오라클", exact: true }).click()
  const oracleMenu = page.getByRole("navigation", { name: "오라클 메뉴" })
  const choices = oracleMenu.getByRole("button")
  await expect(choices).toHaveCount(4)
  await expect(navigation).toHaveCount(0)
  for (const choice of await choices.all()) {
    await expect(choice).toHaveCSS("border-radius", "12px")
    expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(page.getByRole("heading", { name: "내 훈련", exact: true, level: 2 })).toBeVisible()
  await expect(choices.first()).toBeVisible()
  await page.screenshot({ path: info.outputPath("rounded-oracle-default.png"), fullPage: true })
  // A larger user font must grow the face, not clip a fixed-height label.
  await page.addStyleTag({ content: '.app-choice-control, .app-compact-tab, .app-navigation-dock .app-tab-bar__button span { font-size: 28px !important; }' })
  await expectNoHorizontalOverflow(page)
  for (const choice of await choices.all()) {
    expect(await choice.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath("rounded-oracle-large-text.png"), fullPage: true })
  await oracleMenu.getByRole("button", { name: "오라클 나가기" }).click()
  await navigation.getByRole("button", { name: "홈", exact: true }).click()
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  const learning = page.getByRole("button", { name: "훈련법 읽기", exact: true })
  await learning.focus()
  await page.keyboard.press("Tab")
  await page.keyboard.press("Shift+Tab")
  await expect(learning).toBeFocused()
  await expect(learning).toHaveCSS("border-radius", "12px")
  await expect(learning).not.toHaveAttribute("aria-pressed")
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: info.outputPath("rounded-more-large-text.png"), fullPage: true })
})
