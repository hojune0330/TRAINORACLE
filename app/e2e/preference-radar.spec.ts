import { expect, test, type Locator, type Page } from "@playwright/test"

test.use({ serviceWorkers: "block" })
test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  await page.goto("/?app=1&uitest=1")
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
})

async function openProfile(page: Page) {
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: "러닝 취향", exact: false }).click()
  await expect(page.getByRole("heading", { name: "나는 어떤 달리기를 좋아할까요?" })).toBeVisible()
  await page.getByRole("button", { name: "내 훈련 방식 알아보기 · 질문 3개", exact: true }).click()
}

async function answerThree(page: Page, axis: string, response: string) {
  const dialog = page.getByRole("dialog", { name: axis, exact: true })
  for (let count = 0; count < 3; count++) await dialog.getByRole("button", { name: response, exact: true }).click()
  await expect(dialog.getByRole("heading", { name: "내 답을 정리했어요" })).toBeFocused()
  return dialog
}

async function checkRadarLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const radar = page.locator(".preference-radar")
  expect(await radar.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  for (const button of await radar.getByRole("button").all()) {
    const bounds = await button.boundingBox()
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
    expect(bounds!.width).toBeGreaterThanOrEqual(44)
    await expect(button).toHaveCSS("border-top-width", "0px")
  }
}

async function closeResult(dialog: Locator, page: Page) {
  await dialog.getByRole("button", { name: "내 결과 보기", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
}

test("six real scores render a full radar and a single answer edit preserves the other five", async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await openProfile(page)
  let dialog = await answerThree(page, "계획 선호", "매우 그래요")
  const fox = dialog.getByRole("button", { name: "계획을 챙기는 여우 캐릭터 이야기", exact: true })
  await expect.poll(() => fox.locator("img").evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(256)
  await fox.focus()
  await page.keyboard.press("Enter")
  await expect(fox).toHaveAttribute("aria-expanded", "true")
  await page.keyboard.press("Escape")
  await expect(fox).toHaveAttribute("aria-expanded", "false")
  await expect(fox).toBeFocused()
  await expect(dialog).toBeVisible()

  const nextAxes = [
    ["기록 도전도 알아보기", "기록 도전 선호", "그런 편이에요"],
    ["강한 달리기도 알아보기", "높은 강도 선호", "전혀 그렇지 않아요"],
    ["함께 달리기도 알아보기", "함께 달리기 선호", "보통이에요"],
    ["새로운 경험도 알아보기", "새 경험 선호", "그렇지 않은 편이에요"],
    ["기분 전환도 알아보기", "기분 전환 동기", "그런 편이에요"],
  ] as const
  for (const [next, axis, response] of nextAxes) {
    await dialog.getByRole("button", { name: next, exact: true }).click()
    dialog = await answerThree(page, axis, response)
  }
  await closeResult(dialog, page)
  const radar = page.locator(".preference-radar")
  await expect(radar.locator(".preference-radar__shape")).toHaveCount(1)
  await expect(radar.locator(".preference-radar__point")).toHaveCount(6)
  await expect(radar.getByRole("button")).toHaveText([
    "계획100점", "기록 도전75점", "강한 달리기0점", "함께 달리기50점", "새로운 경험25점", "기분 전환75점",
  ])
  await expect(radar.getByRole("img")).toHaveAccessibleName("러닝 취향, 내 응답 기준 0에서 100점. 계획: 100점. 기록 도전: 75점. 강한 달리기: 0점. 함께 달리기: 50점. 새로운 경험: 25점. 기분 전환: 75점.")
  await expect(page.getByRole("button", { name: "계획을 챙기는 여우 캐릭터 이야기", exact: true })).toBeVisible()
  await checkRadarLayout(page)
  await page.setViewportSize({ width: 375, height: 1600 })
  await page.screenshot({ path: info.outputPath("radar-complete-375.png"), fullPage: true, animations: "disabled" })
  await page.setViewportSize({ width: 1440, height: 1400 })
  await checkRadarLayout(page)
  await page.screenshot({ path: info.outputPath("radar-complete-1440.png"), fullPage: true, animations: "disabled" })

  await radar.getByRole("button", { name: "계획, 100점, 결과 보기", exact: true }).click()
  await page.getByRole("dialog", { name: "마리의 응답 해설", exact: true }).getByRole("button", { name: "내 답 수정", exact: true }).click()
  dialog = page.getByRole("dialog", { name: "계획 선호", exact: true })
  await expect(dialog.getByRole("heading", { name: "내 답을 정리했어요" })).toBeVisible()
  await dialog.getByText("내 답 확인·수정", { exact: true }).click()
  await dialog.getByRole("button", { name: /달리기 전에 할 내용을 정해두는 것이 좋아요./u }).click()
  await dialog.getByRole("button", { name: "전혀 그렇지 않아요", exact: true }).click()
  await expect(dialog.locator(".oracle-v2__result-number")).toContainText("65")
  await closeResult(dialog, page)
  await expect(radar.getByRole("button")).toHaveText([
    "계획65점 · 답이 엇갈림", "기록 도전75점", "강한 달리기0점", "함께 달리기50점", "새로운 경험25점", "기분 전환75점",
  ])
  await expect(page.getByRole("button", { name: "계획을 챙기는 여우 캐릭터 이야기", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "마리의 결과 안내", exact: true })).toBeVisible()
  await expect(radar.locator(".preference-radar__shape")).toHaveCount(1)
})

test("a real zero stays distinct from missing answers at 320px with large text and reduced motion", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.route("**/mari-profile-*-v4.webp", route => route.abort())
  await page.route("**/preference-*.webp", route => route.abort())
  await page.evaluate(() => {
    localStorage.setItem("trainoracle.calendar-reduced-motion.v1", "true")
    window.dispatchEvent(new StorageEvent("storage", { key: "trainoracle.calendar-reduced-motion.v1" }))
  })
  await openProfile(page)
  await expect(page.locator(".oracle-v2__question")).toHaveCSS("animation-name", "none")
  let dialog = await answerThree(page, "계획 선호", "전혀 그렇지 않아요")
  await dialog.getByRole("button", { name: "기록 도전도 알아보기", exact: true }).click()
  dialog = page.getByRole("dialog", { name: "기록 도전 선호", exact: true })
  await dialog.getByText("답하기 어려워요", { exact: true }).click()
  await dialog.getByRole("button", { name: "아직 모르겠어요", exact: true }).click()
  await dialog.getByRole("button", { name: "건너뛰기", exact: true }).click()
  await dialog.getByRole("button", { name: "건너뛰기", exact: true }).click()
  await expect(dialog.locator(".oracle-v2__result-number")).toHaveCount(0)
  await closeResult(dialog, page)
  const radar = page.locator(".preference-radar")
  await expect(radar.locator(".preference-radar__shape")).toHaveCount(0)
  await expect(radar.locator(".preference-radar__point")).toHaveCount(1)
  await expect(radar.locator('.preference-radar__point[data-axis="STRUCTURE"]')).toHaveAttribute("cx", "180")
  await expect(radar.locator('.preference-radar__point[data-axis="STRUCTURE"]')).toHaveAttribute("cy", "144")
  await expect(radar.getByRole("button", { name: "계획, 0점, 결과 보기", exact: true })).toBeVisible()
  await expect(radar.getByRole("button", { name: "기록 도전, 응답 보기", exact: true })).toBeVisible()
  await expect(radar.getByRole("button", { name: "강한 달리기, 답 더하기", exact: true })).toBeVisible()
  await checkRadarLayout(page)
  await radar.screenshot({ path: info.outputPath("radar-partial-320.png"), animations: "disabled" })

  await page.addStyleTag({ content: ".oracle-v2 .app-heading.app-heading--screen{font-size:48px} .oracle-v2 p,.oracle-v2 button,.oracle-v2 summary{font-size:28px !important} .preference-radar__value{font-size:24px !important} .preference-radar__value[data-scored=true]{font-size:33px !important}" })
  await expect(radar.getByRole("button", { name: "계획, 0점, 결과 보기", exact: true })).toHaveCSS("font-size", "28px")
  await expect(radar.locator('.preference-radar__value[data-scored="true"]')).toHaveCSS("font-size", "33px")
  await expect(page.locator(".oracle-v2__body .app-heading--screen").first()).toHaveCSS("font-size", "48px")
  await checkRadarLayout(page)
  await expect(radar.getByRole("button").first()).toHaveCSS("transition-duration", "0s")
  await page.getByRole("button", { name: "마리의 결과 안내", exact: true }).click()
  await expect(page.getByText("선택한 답으로 정리한 취향이에요. 실력이나 건강을 평가한 결과는 아니에요.")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "마리의 결과 안내", exact: true })).toHaveAttribute("aria-expanded", "false")
  await page.setViewportSize({ width: 320, height: 2400 })
  await radar.screenshot({ path: info.outputPath("radar-partial-large-320.png"), animations: "disabled" })
})
