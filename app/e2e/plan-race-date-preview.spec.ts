import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { completeDetailedPlan, openPlanRefinement } from "./plan-flow"

async function reachRaceDate(page: Page): Promise<void> {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  await completeDetailedPlan(page, { division: /고등부/u })
  await openPlanRefinement(page, "대회 날짜")
  await expect(page.getByRole("heading", { name: "대회 날짜가 있나요?" })).toBeVisible()
}

for (const viewport of [
  { width: 375, height: 667, label: "mobile" },
  { width: 1440, height: 900, label: "desktop" },
] as const) {
  test(`keeps the race date preview transient at ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await reachRaceDate(page)

    const input = page.getByRole("textbox", { name: "목표 경기 날짜", exact: true })
    await input.fill("2099-08-23")
    await page.getByRole("button", { name: "이 날짜로 배치 미리보기" }).click()

    await expect(page.getByRole("heading", { name: "아직 경기 날짜를 계획에 적용할 수 없어요" })).toBeVisible()
    await expect(page.getByText(/계획안을 저장하거나 시작할 수 없고.*훈련 내용.*양.*강도도 바꾸지 않아요/u)).toBeVisible()
    await expect(page.getByRole("button", { name: /선택하기|계획 시작|계획 저장/u })).toHaveCount(0)
    expect(await page.evaluate(() => {
      const local = Object.values(window.localStorage)
      const session = Object.values(window.sessionStorage)
      return JSON.stringify({ local, session, href: location.href, history: history.state })
    })).not.toContain("2099-08-23")
    expect(await page.evaluate(() => {
      const region = document.querySelector<HTMLElement>(".app-scroll-region")
      return region === null ? true : region.scrollWidth <= region.clientWidth
    })).toBe(true)

    await page.screenshot({
      path: test.info().outputPath(`${viewport.label}-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    })

    await page.getByRole("button", { name: "날짜 없이 일반 계획 보기" }).click()
    await expect(page.getByRole("heading", { name: "계획이 준비됐어요" })).toBeVisible()
    await page.getByText("경기 날짜는 어떻게 되나요?", { exact: true }).click()
    await expect(page.getByText("경기 날짜 없이 만든 일반 계획")).toBeVisible()
  })
}

test("rejects today or an earlier target date before generation", async ({ page }) => {
  await reachRaceDate(page)
  await page.getByRole("textbox", { name: "목표 경기 날짜", exact: true }).fill("2020-01-01")

  await expect(page.getByRole("alert")).toHaveText("오늘보다 뒤의 실제 날짜를 골라주세요.")
  await expect(page.getByRole("button", { name: "이 날짜로 배치 미리보기" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "날짜 없이 계획안 보기" })).toBeEnabled()
})
