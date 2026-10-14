import { expect, test, type Page, type Locator } from "@playwright/test"

test.use({ serviceWorkers: "block" })
test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
})

async function bodyInput(page: Page) {
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기", exact: true }).click()
  await page.getByTestId("entry-choice-evening").click()
  await page.getByRole("button", { name: "몸 상태", exact: true }).click()
}

async function usable(dialog: Locator) {
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  const controls = await dialog.locator("button:visible").evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().height))
  expect(controls.every(height => height >= 44)).toBe(true)
}

test("body selection fits its content and keeps the side, level and completion actions usable", async ({ page }, testInfo) => {
  await bodyInput(page)
  await page.getByRole("button", { name: "발", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toHaveAccessibleName("발 · 어느 쪽인가요?")
  const box = await dialog.boundingBox()
  expect(box!.height, "a two-choice sheet must not fill the phone").toBeLessThan(240)
  const sides = dialog.getByRole("group", { name: "발 좌우 선택" })
  const heights = await sides.getByRole("button").evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().height))
  expect(heights.every(height => height >= 44 && height < 100)).toBe(true)
  await testInfo.attach("side-sheet-measurements", { contentType: "application/json",
    body: JSON.stringify({ viewport: page.viewportSize(), sheet: box, sideButtonHeights: heights }) })
  await usable(dialog)
  await page.screenshot({ path: testInfo.outputPath("01-side-choice.png"), animations: "disabled" })
  await sides.getByRole("button", { name: "왼 발", exact: true }).click()
  await expect(dialog).toHaveAccessibleName("내 왼쪽 발")
  await dialog.locator("img").evaluate(img => (img as HTMLImageElement).decode())
  await page.screenshot({ path: testInfo.outputPath("02-part-focus.png"), animations: "disabled" })
  await dialog.getByRole("button", { name: "왼 발 통증 2단계", exact: true }).click()
  await expect(dialog).toHaveAccessibleName("선택한 부위")
  await expect(dialog.getByRole("button", { name: "왼 발, 통증 2/5", exact: true })).toBeVisible()
  expect((await dialog.boundingBox())!.height).toBeLessThan(300)
  await usable(dialog)
  await page.screenshot({ path: testInfo.outputPath("03-selection-summary.png"), animations: "disabled" })
  await dialog.getByRole("button", { name: "입력 완료", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole("button", { name: "왼 발, 통증 2/5", exact: true })).toBeVisible()
})

test("custom body input preserves its text and selected level through Back and large text", async ({ page }, testInfo) => {
  await bodyInput(page)
  await page.getByRole("button", { name: "기타 부위 추가", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("textbox", { name: "부위 이름", exact: true }).fill("발목 안쪽")
  await dialog.locator("summary").click()
  await dialog.getByRole("textbox", { name: "메모", exact: true }).fill("합성 입력 메모")
  await dialog.getByRole("button", { name: "발목 안쪽 통증 3단계", exact: true }).click()
  await dialog.getByRole("button", { name: "부위 선택으로", exact: true }).click()
  await dialog.getByRole("button", { name: "기타 부위 추가", exact: true }).click()
  await expect(dialog.getByRole("textbox", { name: "부위 이름", exact: true })).toHaveValue("발목 안쪽")
  await expect(dialog.getByRole("textbox", { name: "메모", exact: true })).toHaveValue("합성 입력 메모")
  await expect(dialog.getByRole("button", { name: "발목 안쪽 통증 3단계", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.setViewportSize({ width: 320, height: 568 })
  await dialog.evaluate(el => {
    const nodes = [el, ...el.querySelectorAll<HTMLElement>("*")]
    const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize))
    nodes.forEach((node, index) => { node.style.fontSize = `${sizes[index]! * 2}px` })
  }) // CSS text enlargement, not a claim of an OS or iOS keyboard test.
  await usable(dialog)
  const apply = dialog.getByRole("button", { name: "추가", exact: true })
  await apply.scrollIntoViewIfNeeded()
  const close = dialog.getByRole("button", { name: "몸 상태 입력 닫기", exact: true })
  await expect(close).toBeInViewport()
  expect(await close.evaluate(el => {
    const bounds = el.getBoundingClientRect()
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    return hit === el || (hit !== null && el.contains(hit))
  }), "Close stays available after scrolling the body editor").toBe(true)
  await page.screenshot({ path: testInfo.outputPath("04-large-text-custom.png"), animations: "disabled" })
  await apply.click()
  await expect(dialog).toHaveAccessibleName("선택한 부위")
  await expect(dialog.getByRole("button", { name: "발목 안쪽, 통증 3/5", exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: "입력 완료", exact: true }).click()
  await expect(dialog).toHaveCount(0)
})
