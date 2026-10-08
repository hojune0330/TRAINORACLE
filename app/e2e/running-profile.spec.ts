import { expect, test, type Page } from "@playwright/test"

test.use({ serviceWorkers: "block" })

async function openGuestProfile(page: Page) {
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: "나의 러닝 프로필", exact: true }).click()
  await expect(page.locator(".oracle-v2__status").first()).toContainText("게스트")
}

async function answerAxis(page: Page, axis: string, answer: string) {
  const dialog = page.getByRole("dialog", { name: axis })
  for (let question = 1; question <= 3; question++) {
    await expect(dialog.getByText(`${question} / 3`, { exact: true })).toBeVisible()
    await dialog.getByRole("button", { name: answer, exact: true }).click()
  }
  await expect(dialog.getByRole("heading", { name: "내 답을 정리했어요" })).toBeVisible()
  await dialog.getByRole("button", { name: "결과로" }).click()
}

for (const width of [320, 375, 1440]) {
  test(`guest profile keeps answers within the open app and clears them on reload at ${width}px`, async ({ page }, info) => {
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 812 })
    await page.goto("/?app=1")
    await openGuestProfile(page)
    await page.getByRole("button", { name: "내 훈련 방식 알아보기 · 질문 3개" }).click()
    await answerAxis(page, "계획 선호", "매우 그래요")
    const scores = page.locator(".oracle-v2__scores [role='meter']")
    await expect(scores).toHaveCount(1)
    await expect(scores.first()).toHaveAttribute("aria-valuenow", "100")
    await expect(page.getByRole("button", { name: "이 결과 보관" })).toBeDisabled()
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width)
    await page.screenshot({ path: info.outputPath(`guest-profile-${width}.png`) })

    await page.goBack()
    await expect(page.getByRole("heading", { name: "더보기", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "나의 러닝 프로필", exact: true }).click()
    await expect(scores.first()).toHaveAttribute("aria-valuenow", "100")

    await page.getByRole("button", { name: "마리·친구·프로필 설정" }).click()
    const settings = page.getByRole("dialog", { name: "프로필 설정" })
    await settings.getByText("다른 러닝 취향 알아보기", { exact: true }).click()
    await settings.getByRole("button", { name: "기록 도전 선호" }).click()
    await answerAxis(page, "기록 도전 선호", "그런 편이에요")
    await expect(scores).toHaveCount(2)
    await expect(page.locator(".oracle-v2__scores [role='meter'][aria-valuenow='75']")).toHaveCount(1)
    expect(await page.evaluate(() => JSON.stringify(history.state))).not.toMatch(/STRUCTURE_1|CHALLENGE_1|selectedCharacter|answers/u)

    await page.reload()
    await openGuestProfile(page)
    await expect(page.getByRole("button", { name: "내 훈련 방식 알아보기 · 질문 3개" })).toBeVisible()
    await expect(page.locator(".oracle-v2__scores [role='meter']")).toHaveCount(0)
    await expect(page.locator(".oracle-v2__status").first()).toContainText("새로고침하면 사라져요")
    expect(errors).toEqual([])
  })
}

test("guest profile retains an in-screen draft, keeps question focus, and fits doubled text", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 812 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/?app=1")
  await openGuestProfile(page)
  await page.getByRole("button", { name: "내 훈련 방식 알아보기 · 질문 3개" }).click()
  const dialog = page.getByRole("dialog", { name: "계획 선호" })
  await expect(dialog.getByRole("heading", { name: "달리기 전에 할 내용을 정해두는 것이 좋아요." })).toBeFocused()
  await dialog.getByRole("button", { name: "매우 그래요" }).click()
  await dialog.getByRole("button", { name: "닫기" }).click()
  await page.getByRole("button", { name: "작성하던 답 이어가기" }).click()
  await expect(dialog.getByText("2 / 3", { exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: "이전 질문" }).click()
  await expect(dialog.getByRole("button", { name: "매우 그래요" })).toHaveAttribute("aria-pressed", "true")
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>(".oracle-v2 h1, .oracle-v2 h2, .oracle-v2 p, .oracle-v2 button, .oracle-v2 strong, .oracle-v2 span").forEach(element => {
      element.style.fontSize = `${parseFloat(getComputedStyle(element).fontSize) * 2}px`
    })
  })
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 320)
  await page.screenshot({ path: info.outputPath("guest-profile-draft-text-200.png") })
  await page.reload()
  await openGuestProfile(page)
  await expect(page.getByRole("button", { name: "내 훈련 방식 알아보기 · 질문 3개" })).toBeVisible()
  await expect(page.getByRole("button", { name: "작성하던 답 이어가기" })).toHaveCount(0)
})
