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

async function expectDecoratedPaperAtReadableTop(page: import("@playwright/test").Page): Promise<void> {
  const readGeometry = () => page.evaluate(() => {
    const region = document.querySelector<HTMLElement>(".app-scroll-region")
    const header = document.querySelector<HTMLElement>(".minji-page__header")
    const headerLabel = header?.querySelector<HTMLElement>("span")
    const closeButton = header?.querySelector<HTMLElement>("button")
    const guideBack = document.querySelector<HTMLElement>(".guide-screen__back")
    const paper = document.querySelector<HTMLElement>(".minji-page > .decorated-journal-page")
    if (region === null || header === null || headerLabel === null || headerLabel === undefined
      || closeButton === null || closeButton === undefined || guideBack === null || paper === null) return null
    const regionTop = Math.round(region.getBoundingClientRect().top)
    return {
      closeButtonBottom: Math.round(closeButton.getBoundingClientRect().bottom),
      guideBackBottom: Math.round(guideBack.getBoundingClientRect().bottom),
      headerLabelBottom: Math.round(headerLabel.getBoundingClientRect().bottom),
      paperTop: Math.round(paper.getBoundingClientRect().top),
      regionTop,
    }
  })
  await expect.poll(async () => {
    const geometry = await readGeometry()
    if (geometry === null) return false
    const paperOffset = geometry.paperTop - geometry.regionTop
    return paperOffset >= 0 && paperOffset <= 12
  }).toBe(true)
  const geometry = await readGeometry()
  expect(geometry).not.toBeNull()
  if (geometry === null) return
  expect(geometry.guideBackBottom).toBeLessThanOrEqual(geometry.regionTop)
  expect(geometry.headerLabelBottom).toBeLessThanOrEqual(geometry.regionTop)
  expect(geometry.closeButtonBottom).toBeLessThanOrEqual(geometry.regionTop)
  expect(geometry.paperTop).toBeGreaterThanOrEqual(geometry.regionTop)
  expect(geometry.paperTop).toBeLessThanOrEqual(geometry.regionTop + 12)
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
  const pageButton = page.getByRole("button", { name: /첫날.*4\.6km를 달린 첫 기록/u })
  await pageButton.click()
  await expect(page.getByRole("heading", { name: "4.6km를 달린 첫 기록" })).toBeFocused()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expectDecoratedPaperAtReadableTop(page)
  await expect(page.getByTestId("journal-slot-top-corner")).toBeVisible()
  await expect(page.getByText("시간 30분", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "이 페이지에 쓴 꾸미기" })).toBeVisible()
  for (let pageNumber = 2; pageNumber <= 6; pageNumber += 1) {
    if (pageNumber === 2) await swipeJournalLeft(page)
    else await page.getByRole("button", { name: "다음 일지" }).click()
    await expect(page.getByText(`${pageNumber} / 6`).first()).toBeVisible()
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await expectDecoratedPaperAtReadableTop(page)
    if (pageNumber === 4) {
      await expect(page.getByText("걷기와 계단에서 느낀 오른쪽 무릎 불편함을 적었어요.")).toBeVisible()
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
