import { expect, test } from "@playwright/test"

test("keeps the Korean-first training lexicon readable from narrow phones to desktop", async ({ page }) => {
  const browserErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  page.on("pageerror", (error) => browserErrors.push(error.message))

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto("/?terms=1")
    await expect(page.getByRole("heading", { name: "훈련 용어집" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "자주 보는 용어" })).toBeVisible()
    await expect(page.getByRole("button", { name: /기초 지구력.*BASE/u }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }

  const fontEvidence = await page.evaluate(async () => {
    await document.fonts.ready
    const response = await fetch("fonts/PretendardVariable.woff2", { method: "HEAD" })
    return {
      status: response.status,
      family: window.getComputedStyle(document.body).fontFamily,
      loaded: document.fonts.check('16px "Pretendard Variable"'),
    }
  })
  expect(fontEvidence.status).toBe(200)
  expect(fontEvidence.family).toContain("Pretendard Variable")
  expect(fontEvidence.loaded).toBe(true)

  const search = page.getByRole("searchbox", { name: "용어 검색" })
  await search.fill("해당계")
  const glycolyticTerm = page.getByRole("button", { name: /짧은 고강도 반복.*GLY/u })
  await expect(glycolyticTerm).toBeVisible()
  await glycolyticTerm.click()
  await expect(page.getByRole("heading", { name: /짧은 고강도 반복.*GLY/u })).toBeVisible()
  await expect(page.getByRole("heading", { name: "왜 이런 이름인가요?" })).toBeVisible()
  await page.getByRole("button", { name: "전문 설명" }).click()
  await expect(page.getByRole("heading", { name: "에너지 경로 맥락" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(browserErrors).toEqual([])
})
