import { expect, test } from "@playwright/test"
import { expectNoHorizontalOverflow, seedTouchAuditEntries } from "./touch-audit"

test("keeps compact navigation visible without shrinking its touch target", async ({ page }) => {
  await page.goto("/")

  const navigation = page.getByRole("navigation", { name: "주 탭" })
  const home = navigation.getByRole("button", { name: "홈" })
  const icon = home.locator("svg")

  await expect(navigation).toBeVisible()
  await expect(home).toHaveCSS("min-height", "44px")
  await expect(icon).toHaveCSS("width", "13px")
  await expect(icon).toHaveCSS("height", "13px")
  await expectNoHorizontalOverflow(page)
})

test("keeps analysis view tabs compact and touchable", async ({ page }) => {
  await seedTouchAuditEntries(page)
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()

  const tabs = page.getByRole("region", { name: "최근 4개월 추이" }).getByRole("button")
  await expect(tabs).toHaveCount(4)

  for (const tab of await tabs.all()) {
    const box = await tab.boundingBox()
    expect(box?.height).toBe(44)
    const face = await tab.evaluate((element) => {
      const style = getComputedStyle(element, "::before")
      return { top: style.top, bottom: style.bottom }
    })
    expect(face).toEqual({ top: "6px", bottom: "6px" })
  }

  await expectNoHorizontalOverflow(page)
})
