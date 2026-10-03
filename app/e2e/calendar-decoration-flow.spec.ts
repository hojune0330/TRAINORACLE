import { test, expect, type Locator, type Page } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    // Disable only development profiling overlays, not any product interface.
    if (/\/node_modules\/\.vite\/deps\/react-(scan|grab)\.js$/u.test(url.pathname)) return route.fulfill({ contentType: "application/javascript", body: "export function scan() {}" })
    return url.hostname === "127.0.0.1" || url.protocol === "data:" ? route.continue() : route.abort()
  })
})

async function seed(page: import("@playwright/test").Page) {
  await page.goto("/?app=1")
  const date = await page.evaluate(async () => {
    const decorationPath = "/src/domain/decorations.ts", journalPath = "/src/domain/journal-store.ts"
    const decoration = await import(decorationPath), journal = await import(journalPath)
    const date = journal.todayISO()
    const state = structuredClone(decoration.createEmptyDecorationState())
    state.pages = [{ date, items: [{ itemId: "STICKER_WEATHER_SUN", transform: { xPercent: 80, yPercent: 20, scale: 1, rotationDeg: 12 } }, { itemId: "TEXT_STICKER", text: "합성 비밀 문구", inkId: "TEXT_INK_NAVY", transform: { xPercent: 40, yPercent: 70, scale: 1, rotationDeg: 0 } }] }]
    decoration.saveDecorationState(state)
    journal.saveEntry({ id: "synthetic-calendar-flow", date, savedAt: `${date}T01:00:00.000Z`, kind: "post-session", syncState: "local", system: "base", title: "합성 훈련", distanceKm: "5", durationMin: "30", avgPace: "6:00", rpe: 4, memo: "" })
    return date as string
  })
  await page.reload()
  return date
}

async function waitForDrawerMotion(drawer: Locator) {
  await drawer.evaluate(async (element) => {
    const finiteAnimations = element.getAnimations({ subtree: true }).filter((animation) => {
      const endTime = animation.effect?.getComputedTiming().endTime
      return typeof endTime === "number" && Number.isFinite(endTime)
    })
    await Promise.all(finiteAnimations.map(async (animation) => {
      try { await animation.finished } catch { /* A replaced child animation is no longer relevant. */ }
    }))
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
}

async function openMaterialsDrawer(page: Page) {
  const drawer = page.locator('.journal-decoration-toolbar[data-open="true"]')
  await page.getByRole("button", { name: "재료 서랍 열기", exact: true }).click()
  await expect(drawer).toBeVisible()
  await waitForDrawerMotion(drawer)
  await expect(drawer).toHaveAttribute("data-open", "true")
  await expect(drawer.getByRole("group", { name: "꾸미기 재료 종류" })).toBeVisible()
  return drawer
}

async function expectMaterialsDrawerClosed(page: Page) {
  // Calendar mode unmounts the shared toolbar after applying a material.
  // Waiting for that commit prevents the next open from racing the old drawer.
  await expect(page.locator(".journal-decoration-toolbar")).toHaveCount(0)
}

for (const width of [320, 375, 1440]) test(`unified studio and protected calendar at ${width}px`, async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.setViewportSize({ width, height: 900 })
  const date = await seed(page)
  await page.getByRole("button", { name: "일지 꾸미기", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "일지 꾸미기", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "일지", exact: true })).toHaveAttribute("aria-pressed", "true")
  const before = await page.evaluate(() => localStorage.getItem("trainoracle.decorations.v3"))
  await page.getByRole("button", { name: "달력", exact: true }).click()
  await expect(page.getByRole("grid")).toBeVisible()
  let drawer = await openMaterialsDrawer(page)
  let filters = drawer.getByRole("group", { name: "꾸미기 재료 종류" })
  await filters.getByRole("button", { name: "테마", exact: true }).click()
  await drawer.getByRole("button", { name: /^모눈 연습장/ }).click()
  await expectMaterialsDrawerClosed(page)
  drawer = await openMaterialsDrawer(page)
  filters = drawer.getByRole("group", { name: "꾸미기 재료 종류" })
  const stickerFilter = filters.getByRole("button", { name: "스티커", exact: true })
  await stickerFilter.click()
  await expect(stickerFilter).toHaveAttribute("aria-pressed", "true")
  await drawer.getByRole("button", { name: /^맑은 날/ }).first().click()
  await expect(page.locator(".calendar-decoration-frame__band")).toHaveCount(1)
  const contentBounds = await page.locator(".calendar-decoration-frame__content").boundingBox()
  const gridBounds = await page.getByRole("grid").boundingBox()
  expect(gridBounds!.x).toBeGreaterThanOrEqual(contentBounds!.x - 0.5)
  expect(gridBounds!.x + gridBounds!.width).toBeLessThanOrEqual(contentBounds!.x + contentBounds!.width + 0.5)
  for (const cell of await page.locator(".month-calendar__grid td").all()) {
    const dateNumber = cell.locator(".month-calendar__number")
    if (!await dateNumber.count()) continue
    const numberBounds = await dateNumber.boundingBox()
    expect(numberBounds!.x).toBeGreaterThanOrEqual(contentBounds!.x - 0.5)
    expect(numberBounds!.x + numberBounds!.width).toBeLessThanOrEqual(contentBounds!.x + contentBounds!.width + 0.5)
  }
  const artTarget = page.locator(".calendar-decoration-frame__item").first()
  const targetBox = await artTarget.boundingBox()
  expect(targetBox!.width).toBeGreaterThanOrEqual(44)
  expect(targetBox!.height).toBeGreaterThanOrEqual(44)
  await page.screenshot({ path: testInfo.outputPath(`calendar-${width}.png`), fullPage: true })
  expect(await page.locator(".journal-decoration-workspace").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.getByRole("button", { name: "일지", exact: true }).click()
  await expect(page.getByRole("alertdialog")).toBeVisible()
  await page.getByRole("button", { name: "계속 편집", exact: true }).click()
  await page.getByRole("button", { name: "모든 달에 적용", exact: true }).click()
  await expect(page.getByText("이 기기에 저장됨", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.decorations.v3"))).toBe(before)
  await page.keyboard.press("Escape") // clear selected decoration before closing
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "일지 꾸미기", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "일지 꾸미기", exact: true }).click()
  await expect(page.getByRole("button", { name: "일지", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "꾸미기 완료", exact: true }).click()
  await page.getByRole("button", { name: "일지", exact: true }).click()
  await expect(page.locator(`button[data-date="${date}"] .journal-decoration-preview`)).toHaveCount(1)
  expect(await page.locator(".month-calendar").innerText()).not.toContain("합성 비밀 문구")
  expect(errors).toEqual([])
})

test("large text, keyboard and browser back preserve draft and preview", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await seed(page)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.getByRole("button", { name: "일지 꾸미기", exact: true }).click()
  await page.getByRole("button", { name: "달력", exact: true }).click()
  await page.addStyleTag({ content: ":root { --fs-body:20px; --fs-body-sm:18px; --fs-caption:16px; --fs-h3:24px; } .journal-decoration-workspace { font-size:20px; }" })
  const drawer = await openMaterialsDrawer(page)
  const drawerBox = await drawer.boundingBox()
  expect(drawerBox!.height).toBeLessThanOrEqual(812 / 2 + 1)
  const filters = drawer.getByRole("group", { name: "꾸미기 재료 종류" })
  await filters.getByRole("button", { name: "스티커", exact: true }).click()
  await drawer.getByRole("button", { name: /^맑은 날/ }).first().click()
  const target = page.locator(".calendar-decoration-frame__item").first()
  await target.focus(); await page.keyboard.press("+"); await page.keyboard.press("]")
  const band = await page.locator(".calendar-decoration-frame__band").boundingBox()
  const art = await target.locator(".calendar-decoration-frame__art").boundingBox()
  expect(art!.y).toBeGreaterThanOrEqual(band!.y + 8 - 0.5)
  expect(art!.y + art!.height).toBeLessThanOrEqual(band!.y + 72 - 8 + 0.5)
  expect(await page.locator(".journal-decoration-workspace").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("calendar-large-text.png"), fullPage: true })
  await page.goBack() // selected art closes first; editor and draft remain
  await expect(page.getByRole("dialog", { name: "일지 꾸미기", exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole("alertdialog")).toBeVisible()
  await page.getByRole("button", { name: "변경 버리기", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "일지 꾸미기", exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.calendar-decorations.v1"))).toBeNull()
})

test("empty calendar creates no fake journals and cancel discards only the draft", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto("/?app=1")
  await page.getByRole("button", { name: "일지 꾸미기", exact: true }).click()
  await page.getByRole("button", { name: "달력", exact: true }).click()
  const drawer = await openMaterialsDrawer(page)
  const filters = drawer.getByRole("group", { name: "꾸미기 재료 종류" })
  await filters.getByRole("button", { name: "테마", exact: true }).click()
  await drawer.getByRole("button", { name: /^모눈 연습장/ }).click()
  await expectMaterialsDrawerClosed(page)
  await page.getByRole("button", { name: "취소", exact: true }).click()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.calendar-decorations.v1"))).toBeNull()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.journal.v1") ?? "[]"))).toEqual([])
  await expect(page.getByRole("button", { name: "일지", exact: true })).toHaveAttribute("aria-pressed", "true")
})
