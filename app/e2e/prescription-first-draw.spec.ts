import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test("current plans use catalog while the historical LT pilot keeps bounded alternatives without saving", async ({ page, baseURL }, testInfo) => {
  if (!baseURL) throw Error("A configured local browser origin is required")
  const origin = new URL(baseURL).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({ width: 375, height: 667 })
  await page.clock.setFixedTime(new Date("2026-09-28T12:00:00.000Z"))
  await page.addInitScript(() => {
    sessionStorage.setItem("trainoracle.plan-beta.previous-intake.v1", JSON.stringify({
      eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "NOT_PROVIDED",
      experienceBand: "EXPERIENCED", availableDayCount: 3, requestedFrameLength: 9,
      trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "VARIES", selectedDetailedTemplateRef: null,
    }))
  })
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await expect(page.getByRole("button", { name: "처방 훈련 확인", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "처방 확인·조절", exact: true }).click()
  await expect(page.getByRole("combobox", { name: "바꿀 일정", exact: true })).toHaveValue("5:AM")
  await expect(page.getByRole("combobox", { name: "훈련 구성", exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()

  // Retained historical raw-RPE scope, not a current catalog plan stripped of its binding.
  await page.goto("/e2e/fixtures/historical-lt-first-draw.html")
  await expect(page.getByRole("heading", { name: "이번 계획의 주요 훈련" })).toBeVisible()
  const history = page.locator("summary", { hasText: "추천에 참고한 이력" })
  await expect(history.locator("..")).not.toHaveAttribute("open")
  await page.getByRole("button", { name: "이 훈련 구성 바꾸기" }).click()
  const dialog = page.getByRole("dialog", { name: "훈련 바꾸기" })
  const preview = dialog.getByRole("region", { name: "훈련 미리보기" })
  await expect(preview.locator("code")).toHaveText("20min @ RPE 6–7")
  await expect(preview.getByText("템포런 · Tempo Run", { exact: true })).toBeVisible()
  const storage = await page.evaluate(() => JSON.stringify(localStorage))
  await dialog.getByRole("button", { name: "다른 훈련", exact: true }).click()
  await expect(preview.locator("code")).toHaveText("2 × 10min @ RPE 6–7 · r60s Jog")
  await expect(dialog.getByText("훈련 목록·다른 설정").locator("..")).not.toHaveAttribute("open")
  const detail = preview.getByText("자세히 보기 · 준비부터 정리까지").locator("..")
  await expect(detail).not.toHaveAttribute("open")
  await detail.locator("summary").click()
  await expect(detail.getByRole("heading", { name: "준비", exact: true })).toBeVisible()
  await detail.locator("summary").click()
  await dialog.getByRole("button", { name: "1회 운동 시간 줄이기" }).click()
  await expect(preview.locator("code")).toHaveText("2 × 8min @ RPE 6–7 · r60s Jog")
  await dialog.getByRole("button", { name: "되돌리기", exact: true }).click()
  await expect(preview.locator("code")).toHaveText("2 × 10min @ RPE 6–7 · r60s Jog")
  await dialog.getByRole("button", { name: "다른 훈련", exact: true }).click()
  await expect(preview.locator("code")).toHaveText("20min @ RPE 6–7")
  await dialog.getByRole("button", { name: "다른 훈련", exact: true }).click()
  await expect(preview.locator("code")).toHaveText("2 × 10min @ RPE 6–7 · r60s Jog")
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storage)
  await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  const next = dialog.getByRole("button", { name: "다른 훈련", exact: true })
  expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await page.screenshot({ path: testInfo.outputPath("prescription-first.png") })
  await preview.getByRole("button", { name: "훈련표 읽는 법 설명 보기" }).click()
  await expect(preview.getByRole("note")).toContainText("r은 반복 사이")
  await page.keyboard.press("Escape")
  await expect(dialog).toBeVisible()
  await expect(preview.getByRole("button", { name: "훈련표 읽는 법 설명 보기" })).toBeFocused()
  if (testInfo.project.name === "mobile-chromium") {
    const originalFont = await preview.locator("code").evaluate(element => parseFloat(getComputedStyle(element).fontSize))
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    expect(await preview.locator("code").evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(originalFont * 1.8)
    await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    const more = preview.locator("summary", { hasText: "자세히 보기 · 준비부터 정리까지" })
    await more.focus()
    await page.keyboard.press("Enter")
    await expect(more.locator("..")).toHaveAttribute("open")
    await expect(preview.getByRole("heading", { name: "준비", exact: true })).toBeVisible()
    await preview.getByRole("heading", { name: "준비", exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath("prescription-detail-200-percent.png") })
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storage)
  }
  expect(errors).toEqual([])
})
