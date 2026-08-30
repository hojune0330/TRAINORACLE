import { expect, test } from "@playwright/test"

async function swipeJournalLeft(page: import("@playwright/test").Page): Promise<void> {
  await page.locator(".minji-page").evaluate((element) => {
    const start = new Touch({ identifier: 1, target: element, clientX: 270, clientY: 260 })
    const move = new Touch({ identifier: 1, target: element, clientX: 170, clientY: 262 })
    const end = new Touch({ identifier: 1, target: element, clientX: 110, clientY: 263 })
    element.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [start], changedTouches: [start] }))
    element.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [move], changedTouches: [move] }))
    element.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [end] }))
  })
}

async function expectDiaryContentAtReadableTop(page: import("@playwright/test").Page): Promise<void> {
  await expect.poll(() => page.getByTestId("decorated-journal-content").evaluate((element) => (
    Math.round(element.getBoundingClientRect().top)
  ))).toBeLessThanOrEqual(96)
  await expect.poll(() => page.getByTestId("decorated-journal-content").evaluate((element) => (
    Math.round(element.getBoundingClientRect().top)
  ))).toBeGreaterThanOrEqual(0)
}

test("opens Minji's diary as a readable page stack", async ({ page }, testInfo) => {
  const errors: string[] = []
  const writeRequests: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("request", (request) => {
    if (request.method() !== "GET" || request.resourceType() === "fetch" || request.resourceType() === "xhr") {
      writeRequests.push(`${request.method()} ${request.url()}`)
    }
  })

  await page.goto("/")
  await page.getByRole("button", { name: "더보기" }).click()
  await page.getByRole("button", { name: "민지의 예시 일지" }).click()
  const storageBefore = await page.evaluate(() => JSON.stringify({ ...window.localStorage }))

  await expect(page.getByLabel("민지의 꾸며진 일지 미리보기")).toBeVisible()
  const previewGeometry = await page.evaluate(() => {
    const preview = document.querySelector<HTMLElement>(".minji-showcase-preview")
    const list = document.querySelector<HTMLElement>(".minji-index__stack")
    if (preview === null || list === null) return null
    const previewRect = preview.getBoundingClientRect()
    const listRect = list.getBoundingClientRect()
    return { previewBottom: previewRect.bottom, listTop: listRect.top }
  })
  expect(previewGeometry).not.toBeNull()
  expect(previewGeometry?.previewBottom).toBeLessThanOrEqual(previewGeometry?.listTop ?? 0)
  const pageButton = page.getByRole("button", { name: /첫날.*처음 적은 한 줄/u })
  await pageButton.click()
  await expect(page.getByRole("heading", { name: "처음 적은 한 줄" })).toBeFocused()
  await expect(page.getByText("가상 기록 · 예시 꾸미기")).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expectDiaryContentAtReadableTop(page)
  await expect(page.getByText("시간 30분")).toBeVisible()
  await expect(page.getByRole("heading", { name: "이 페이지에 쓴 꾸미기" })).toBeVisible()
  for (let pageNumber = 2; pageNumber <= 6; pageNumber += 1) {
    if (pageNumber === 2) await swipeJournalLeft(page)
    else await page.getByRole("button", { name: "다음 일지" }).click()
    await expect(page.getByText(`${pageNumber} / 6`).first()).toBeVisible()
    await expect(page.getByText("가상 기록 · 예시 꾸미기")).toBeVisible()
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await expectDiaryContentAtReadableTop(page)
    if (pageNumber === 4) {
      await expect(page.getByText("무릎이 신경 쓰이는 날의 상태를 남겼어요.")).toBeVisible()
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("minji-diary-page.png"), fullPage: true })

  await page.getByRole("button", { name: "민지의 일지 닫기" }).click()
  const storageAfter = await page.evaluate(() => JSON.stringify({ ...window.localStorage }))
  expect(storageAfter).toBe(storageBefore)
  expect(writeRequests).toEqual([])
  expect(errors).toEqual([])
})
