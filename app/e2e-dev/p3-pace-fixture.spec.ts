import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/?p3-pace-fixture=1")
  await expect(
    page.getByRole("heading", { name: "기준 기록을 고르세요" }),
  ).toBeVisible()
  await expect(page.locator("#react-scan-root")).toHaveCount(0)
  await expect(page.locator(".ph-no-capture")).toHaveCount(0)
})

test("shows current same-event pace only after two explicit choices", async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })

  await page
    .getByRole("button", { name: /개인 최고.*5000m.*18분 30초/u })
    .focus()
  await page.keyboard.press("Enter")

  await expect(
    page.getByRole("heading", {
      name: "이 기록이 지금 실력을 나타내나요?",
    }),
  ).toBeVisible()
  await expect(page.getByText("3분 42초")).toHaveCount(0)

  await page.getByRole("button", { name: /^현재 실력으로 사용/u }).focus()
  await page.keyboard.press("Enter")

  const todayTarget = page.locator(".pace-evidence-targets > div").first()
  const goalTarget = page.locator(".pace-evidence-goal")
  await expect(todayTarget).toContainText("오늘 반복 목표")
  await expect(todayTarget).toContainText("3분 42초")
  await expect(goalTarget).toContainText("목표 기록 기준")
  await expect(goalTarget).toContainText("3분 30초 · 참고용")
  await expect(
    page.getByText("목표 기록은 오늘 지시가 아니에요."),
  ).toBeVisible()

  const emphasis = await page.evaluate(() => {
    const today = document.querySelector(".pace-evidence-targets > div dd")
    const goal = document.querySelector(".pace-evidence-goal dd")
    if (!(today instanceof HTMLElement) || !(goal instanceof HTMLElement)) {
      return null
    }
    const todayStyle = getComputedStyle(today)
    const goalStyle = getComputedStyle(goal)
    return {
      todaySize: Number.parseFloat(todayStyle.fontSize),
      goalSize: Number.parseFloat(goalStyle.fontSize),
      todayWeight: Number.parseInt(todayStyle.fontWeight, 10),
      goalWeight: Number.parseInt(goalStyle.fontWeight, 10),
    }
  })
  expect(emphasis).not.toBeNull()
  if (emphasis !== null) {
    expect(emphasis.goalSize).toBeLessThanOrEqual(emphasis.todaySize)
    expect(emphasis.goalWeight).toBeLessThanOrEqual(emphasis.todayWeight)
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
  expect(errors).toEqual([])
  if (testInfo.project.name === "mobile") {
    await page.screenshot({
      path: "../.omo/evidence/task-7-p3-pace-393x852.png",
      fullPage: true,
    })
  }
})

test("keeps stale and unknown choices numeric-free", async ({ page }, testInfo) => {
  for (const choice of [
    "참고 기록으로만 보기",
    "아직 모르겠어요",
  ] as const) {
    await page
      .getByRole("button", { name: /개인 최고.*5000m.*18분 30초/u })
      .click()
    await page.getByRole("button", { name: new RegExp(`^${choice}`, "u") }).click()

    await expect(
      page.getByText("숫자 페이스 대신 체감강도로 안내합니다."),
    ).toBeVisible()
    await expect(page.getByText("3분 42초")).toHaveCount(0)
    await expect(page.getByText("3분 30초")).toHaveCount(0)
    if (
      testInfo.project.name === "touch-narrow"
      && choice === "참고 기록으로만 보기"
    ) {
      await page.screenshot({
        path: "../.omo/evidence/task-7-p3-pace-error.png",
        fullPage: true,
      })
    }

    await page.getByRole("button", { name: "현재성 다시 선택" }).click()
    await page.getByRole("button", { name: "다른 기록 고르기" }).click()
  }
})
