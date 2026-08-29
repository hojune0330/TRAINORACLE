import { expect, test } from "@playwright/test"

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
  expect(await page.evaluate(() => {
    const region = document.querySelector(".app-scroll-region")
    return region instanceof HTMLElement ? region.scrollTop : -1
  })).toBe(0)
  await expect(page.getByText("시간 30분")).toBeVisible()
  await expect(page.getByRole("heading", { name: "이 페이지에 쓴 꾸미기" })).toBeVisible()
  for (let pageNumber = 2; pageNumber <= 6; pageNumber += 1) {
    await page.getByRole("button", { name: "다음 일지" }).click()
    await expect(page.getByText(`${pageNumber} / 6`).first()).toBeVisible()
    await expect(page.getByText("가상 기록 · 예시 꾸미기")).toBeVisible()
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    expect(await page.evaluate(() => {
      const region = document.querySelector(".app-scroll-region")
      return region instanceof HTMLElement ? region.scrollTop : -1
    })).toBe(0)
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
