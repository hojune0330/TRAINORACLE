import { expect, test } from "@playwright/test"
import { openEntry } from "./touch-audit"
import { completeQuickPlan, openPlanOptions } from "./plan-flow"

test("enlarged navigation labels stay inside their buttons and update the reserved height", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  const navigation = page.getByRole("navigation", { name: "주 탭", exact: true })
  await expect(navigation).toBeVisible()
  await navigation.locator("span").evaluateAll(labels => {
    const sizes = labels.map(label => [label, parseFloat(getComputedStyle(label).fontSize)] as const)
    for (const [label, size] of sizes) (label as HTMLElement).style.fontSize = `${size * 2}px`
  })
  expect(await navigation.locator("span").evaluateAll(labels => labels.every(label => {
    const text = label.getBoundingClientRect()
    const button = label.closest("button")!.getBoundingClientRect()
    return text.left >= button.left - 1 && text.right <= button.right + 1 && label.scrollWidth <= label.clientWidth + 1
  }))).toBe(true)
  await expect.poll(() => navigation.evaluate(element => {
    const style = getComputedStyle(element)
    const safeArea = parseFloat(style.getPropertyValue("--app-shell-tab-bar-safe-area")) || 0
    const actual = element.getBoundingClientRect().height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0) - safeArea
    const reserved = parseFloat(getComputedStyle(element.closest(".app-shell")!).getPropertyValue("--app-shell-tab-bar-height"))
    return Math.abs(actual - reserved) < 1
  })).toBe(true)
  await expect.poll(() => navigation.evaluate(element => {
    const shell = element.closest(".app-shell")!
    const content = shell.querySelector(".app-scroll-region")!
    const reserved = parseFloat(getComputedStyle(shell).getPropertyValue("--app-shell-tab-bar-height"))
    const safeArea = parseFloat(getComputedStyle(element).getPropertyValue("--app-shell-tab-bar-safe-area")) || 0
    return Math.abs(shell.getBoundingClientRect().bottom - content.getBoundingClientRect().bottom - reserved - safeArea) < 1
  }), { message: "The measured footer must match the actual space below the scrolling content" }).toBe(true)
  await page.screenshot({ path: test.info().outputPath("tabs-text-200.png") })
})

test("the portalled plan code explanation stays above the measured navigation at normal and enlarged text", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto("/?app=1&uitest=1")
  const navigation = page.getByRole("navigation", { name: "주 탭", exact: true })
  await navigation.getByRole("button", { name: "훈련", exact: true }).click()
  await completeQuickPlan(page)
  await openPlanOptions(page, true)
  const before = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
  const trigger = page.locator('.plan-candidate [data-variant="badge"] button').first()
  await trigger.click()
  const explanation = page.locator("body > .plan-flow-code-help__floating-card")
  await expect(explanation).toBeVisible()
  await page.screenshot({ path: test.info().outputPath("plan-code-explanation-375.png") })
  const gap = () => explanation.evaluate(element => {
    const footer = document.querySelector(".app-shell .app-tab-bar")!
    return footer.getBoundingClientRect().top - element.getBoundingClientRect().bottom
  })
  await expect.poll(async () => Math.abs(await gap() - 8), { message: "The body portal must clear the entire measured footer by 8px" }).toBeLessThan(1)
  await navigation.locator("span").evaluateAll(labels => {
    const sizes = labels.map(label => [label, parseFloat(getComputedStyle(label).fontSize)] as const)
    for (const [label, size] of sizes) (label as HTMLElement).style.fontSize = `${size * 2}px`
  })
  await expect.poll(async () => Math.abs(await gap() - 8), { message: "The open portal must follow navigation height changes" }).toBeLessThan(1)
  await page.screenshot({ path: test.info().outputPath("plan-code-explanation-text200-375.png") })
  await page.keyboard.press("Escape")
  await expect(explanation).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(before)
})

test("narrow comparison CSS stacks both synthetic method columns without an implicit second column", async ({ page }) => {
  await page.setViewportSize({ width: 280, height: 700 })
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("navigation", { name: "주 탭", exact: true }).waitFor()
  await page.evaluate(() => {
    const fixture = document.createElement("section")
    fixture.className = "plan-main-comparison"
    fixture.dataset.testid = "ds02-comparison-layout"
    fixture.style.cssText = "position:fixed;inset:0;z-index:10000;background:var(--surface);padding:16px;box-sizing:border-box;overflow:auto"
    const pair = document.createElement("div")
    pair.className = "plan-main-comparison__pair"
    for (const name of ["A", "B"]) {
      const column = document.createElement("div")
      column.className = "plan-main-comparison__values"
      const title = document.createElement("strong")
      title.textContent = name
      column.append(title)
      const values = document.createElement("dl")
      for (let index = 0; index < 5; index += 1) {
        const row = document.createElement("div")
        const label = document.createElement("dt")
        label.textContent = `Field ${index + 1}`
        const value = document.createElement("dd")
        value.textContent = name === "A" ? "Synthetic short value" : "Synthetic longer comparison value with a different line count"
        row.append(label, value)
        values.append(row)
      }
      column.append(values)
      pair.append(column)
    }
    fixture.append(pair)
    document.body.append(fixture)
  })
  const columns = page.getByTestId("ds02-comparison-layout").locator(".plan-main-comparison__values")
  const first = (await columns.nth(0).boundingBox())!
  const second = (await columns.nth(1).boundingBox())!
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1)
  expect(Math.abs(second.x - first.x)).toBeLessThan(1)
})

test("home navigation remains usable when the bundled font cannot load", async ({ page }) => {
  let blockedFonts = 0
  await page.route(/\.(?:woff2?|ttf)(?:\?.*)?$/u, route => {
    blockedFonts += 1
    return route.abort()
  })
  await page.goto("/?app=1&uitest=1")
  const navigation = page.getByRole("navigation", { name: "주 탭", exact: true })
  await expect(navigation).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  expect(blockedFonts).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await navigation.getByRole("button", { name: "훈련", exact: true }).click()
  await expect(page.getByRole("heading", { name: "어떤 종목을 준비하세요?" })).toBeVisible()
  await expect(page.getByRole("button", { name: "5km", exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("review receipt has one modal-owned copy and a keyboard reachable dismissal", async ({ page }) => {
  await page.clock.install()
  await openEntry(page, /빠르게 기록.*거리·시간·힘든 정도/u)
  await page.getByRole("button", { name: "오늘은 쉬었어요", exact: true }).click()
  await page.getByRole("button", { name: "글 추가", exact: true }).click()
  await page.getByRole("textbox", { name: "일지 내용", exact: true }).fill("무릎이 아파")
  await page.getByRole("radio", { name: "훈련 메모" }).click()
  await page.getByRole("button", { name: "내용 반영", exact: true }).click()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
  await expect(page.locator(".journal-save-result")).toHaveCount(1)
  await expect(page.locator(".saved-toast")).toHaveCount(0)
  await expect(page.getByRole("alert")).toContainText("자동 확인을 완료하지 못했어요. 안전 여부를 판정한 것이 아니에요.")
  await page.getByRole("button", { name: "완료", exact: true }).click()
  await expect(page.getByRole("alert")).toBeVisible()
  await page.clock.fastForward(60_000)
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(page.locator(".saved-toast")).toHaveCount(1)
  await page.getByRole("region", { name: "최근 하루 기록" }).getByRole("button", { name: /기록 1개 보기/u }).click()
  await expect.poll(() => page.locator(".saved-toast").evaluate(element => {
    const shell = element.closest(".app-shell")!
    const content = shell.querySelector(".app-scroll-region")!.getBoundingClientRect()
    const tabs = shell.querySelector(".app-tab-bar")!.getBoundingClientRect()
    const notice = element.getBoundingClientRect()
    return content.bottom <= notice.top + 1 && notice.bottom <= tabs.top + 1 && content.height > 0
  }), { message: "Persistent review must reserve space between the journal and navigation" }).toBe(true)
  await page.screenshot({ path: test.info().outputPath("review-receipt-journal.png") })
  await page.getByRole("button", { name: "일지 꾸미기 열기", exact: true }).click()

  const editor = page.getByRole("dialog", { name: "일지 꾸미기", exact: true })
  const dismiss = editor.getByRole("button", { name: "검토 안내 닫기", exact: true })
  await expect(dismiss).toBeVisible()
  await expect(page.locator(".saved-toast")).toHaveCount(1)
  await page.screenshot({ path: test.info().outputPath("review-receipt-editor.png") })
  await editor.evaluate(element => { element.scrollTop = 40 })
  const close = editor.getByRole("button", { name: "꾸미기 편집기 닫기", exact: true })
  expect(await close.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2))
  }), "The scrolling receipt must not cover the sticky editor close button").toBe(true)
  await editor.evaluate(element => { element.scrollTop = 0 })
  await editor.getByRole("button", { name: "꾸미기 편집기 닫기", exact: true }).focus()

  let reached = false
  for (let step = 0; step < 48; step += 1) {
    await page.keyboard.press("Tab")
    if (await dismiss.evaluate(element => document.activeElement === element)) {
      reached = true
      break
    }
    expect(await editor.evaluate(element => element.contains(document.activeElement))).toBe(true)
  }
  expect(reached, "Tab must reach the persistent review receipt dismissal inside the editor").toBe(true)
  await page.keyboard.press("Enter")
  await expect(page.locator(".saved-toast")).toHaveCount(0)
  await expect(editor).toBeVisible()
  await close.click()
  await expect(editor).not.toBeVisible()
})
