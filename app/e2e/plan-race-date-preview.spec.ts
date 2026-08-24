import { mkdirSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { selectNineDayProjection } from "./plan-flow"

const evidenceDirectory = path.resolve(
  process.cwd(),
  "../.omo/evidence/personalized-prescription-algorithm-v2/task-9/race-date-preview",
)

test.beforeAll(() => {
  mkdirSync(evidenceDirectory, { recursive: true })
})

async function reachRaceDate(page: Page): Promise<void> {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/u }).click()
  await page.getByRole("button", { name: /^1500m/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /지속 페이스.*LT/u }).click()
  await page.getByRole("button", { name: /RPE 기준으로 받기/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /날마다 달라요/u }).click()
  await page.getByRole("button", { name: /하루 한 번 운동/u }).click()
  await expect(page.getByRole("heading", { name: "목표 경기 날짜가 있나요? (선택)" })).toBeVisible()
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
    await expect(page.getByText(/계획 후보를 저장하거나 시작할 수 없고.*훈련 내용.*양.*강도도 바꾸지 않아요/u)).toBeVisible()
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
      path: path.join(evidenceDirectory, `${viewport.label}-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    })

    await page.getByRole("button", { name: "날짜 없이 일반 계획 보기" }).click()
    await expect(page.getByRole("heading", { name: "두 계획에서 하나를 골라보세요" })).toBeVisible()
    await expect(page.getByText("경기 날짜 없이 만든 일반 계획")).toBeVisible()
  })
}

test("rejects today or an earlier target date before generation", async ({ page }) => {
  await reachRaceDate(page)
  await page.getByRole("textbox", { name: "목표 경기 날짜", exact: true }).fill("2020-01-01")

  await expect(page.getByRole("alert")).toHaveText("오늘보다 뒤의 실제 날짜를 골라주세요.")
  await expect(page.getByRole("button", { name: "이 날짜로 배치 미리보기" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "날짜 없이 계획 후보 보기" })).toBeEnabled()
})
