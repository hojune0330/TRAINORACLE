import { expect, test } from "@playwright/test"
import path from "node:path"

test("compact questions, named disclosures and preview-first flows remain usable", async ({ page }, testInfo) => {
  const failures: string[] = []
  page.on("pageerror", error => failures.push(error.message))
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.protocol === "data:" ? route.continue() : route.abort()
  })
  const evidence = path.resolve("../reports/review/evidence/ux-clarity-20261007")
  const capture = async (name: string) => {
    await page.evaluate(() => document.fonts.ready)
    await page.locator("img").evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: path.join(evidence, `${testInfo.project.name}-${name}.png`), fullPage: true })
  }
  await page.goto("/e2e/fixtures/ux-clarity.html?screen=quick")
  await expect(page.getByRole("button", {name: "운동을 마쳤어요"})).toBeVisible()
  await capture("quick-outcome")
  await page.getByRole("button", {name: "운동을 마쳤어요"}).click()
  await expect(page.getByRole("button", {name: "운동을 마쳤어요"})).toHaveCount(0)
  await page.getByRole("button", {name: "오후", exact: true}).click()
  await expect(page.getByRole("button", {name: "오전", exact: true})).toHaveCount(0)
  await capture("quick-effort")
  await page.getByRole("button", {name: /^힘든 정도 6\/10/}).click()
  await capture("quick-body")
  await page.getByRole("button", {name: /뒤로/}).first().click()
  await expect(page.getByRole("button", {name: /^힘든 정도 6\/10/})).toHaveAttribute("aria-pressed", "true")
  // Never save: this is a presentation and navigation check in an isolated context.
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  page.on("dialog", dialog => dialog.accept())
  for (const surface of ["oracle", "profile", "plan", "pace", "records", "calendar"]) {
    await page.goto(`/e2e/fixtures/ux-clarity.html?screen=${surface}`)
    await expect(page.locator("#ux-qa")).not.toBeEmpty()
    await capture(surface)
  }
  await page.goto("/e2e/fixtures/workout-memo.html")
  await page.getByRole("button", {name: "간단히", exact: true}).click()
  await capture("memo-compact")
  await page.getByRole("button", {name: "자세히", exact: true}).click()
  await capture("memo-detail")
  expect(failures).toEqual([])
})

test("200 percent text and keyboard disclosure retain content and controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone-375", "One focused text-size run, not a device matrix")
  const evidence = path.resolve("../reports/review/evidence/ux-clarity-20261007")
  for (const surface of ["quick", "oracle", "profile", "plan", "records", "calendar"]) {
    await page.goto(`/e2e/fixtures/ux-clarity.html?screen=${surface}`)
    await expect(page.locator("#ux-qa")).not.toBeEmpty()
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(Array.from(document.images, image => image.decode()))
      const sizes = Array.from(document.querySelectorAll<HTMLElement>("#ux-qa, #ux-qa *"), element => {
        const style = getComputedStyle(element)
        return {element, font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight)}
      })
      for (const {element, font, line} of sizes) {
        element.style.fontSize = `${font * 2}px`
        if (Number.isFinite(line)) element.style.lineHeight = `${line * 2}px`
      }
    })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    for (const number of await page.locator(".month-calendar__number").all()) {
      expect(await number.evaluate(element => {
        const range = document.createRange()
        range.selectNodeContents(element)
        return range.getClientRects().length
      })).toBe(1)
    }
    const summary = page.locator("summary").first()
    if (await summary.count()) {
      await summary.focus()
      await page.keyboard.press("Enter")
      await expect(summary.locator("..")).toHaveAttribute("open", "")
      await page.keyboard.press("Enter")
      await expect(summary.locator("..")).not.toHaveAttribute("open", "")
    }
    await page.screenshot({path: path.join(evidence, `text-200-${surface}.png`), fullPage: true})
  }
})
