import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { chromium } from "@playwright/test"

const root = process.env.WORKOUT_PREVIEW_URL ?? "http://127.0.0.1:4211"
const out = resolve("../reports/implementation/evidence/workout-choice-20260928")
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: "chrome", headless: true })
const results = []
const interactionRuns = []
try {
  for (const scenario of [
    { width: 320, height: 568, motion: "no-preference", zoom: 1 },
    { width: 375, height: 667, motion: "no-preference", zoom: 1 },
    { width: 375, height: 667, motion: "reduce", zoom: 1 },
    { width: 320, height: 568, motion: "reduce", zoom: 2 },
    { width: 1440, height: 900, motion: "no-preference", zoom: 1 },
  ]) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, reducedMotion: scenario.motion })
    const page = await context.newPage(), errors = []
    page.on("pageerror", error => errors.push(error.message))
    await page.goto(`${root}/e2e/fixtures/prescription-editor-v3.html`)
    if (scenario.zoom === 2) await page.addStyleTag({ content: "html { font-size: 200% !important; }" })
    await page.getByRole("button", { name: "편집기 열기" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "반복 늘리기" }).click()
    await dialog.getByRole("button", { name: "되돌리기", exact: true }).click()
    assert.equal(await dialog.getByRole("button", { name: "변경안 적용" }).isDisabled(), true)
    await dialog.getByRole("button", { name: "다시 하기", exact: true }).click()
    const start = performance.now()
    await dialog.getByRole("button", { name: "다른 훈련", exact: true }).click()
    await dialog.getByRole("region", { name: "훈련 미리보기" }).getByText("2세트", { exact: true }).waitFor()
    await dialog.getByRole("button", { name: "본 방법 다시 보기", exact: true }).waitFor()
    assert.equal(await dialog.getByRole("button", { name: "다른 훈련", exact: true }).count(), 0)
    const interactionMs = performance.now() - start
    assert.equal(await dialog.getByRole("table").count(), 0)
    const geometry = await dialog.evaluate(element => ({
      viewport: window.innerWidth, body: document.documentElement.scrollWidth,
      content: element.querySelector(".prescription-adjustment__content").scrollWidth,
      contentWidth: element.querySelector(".prescription-adjustment__content").clientWidth,
      smallButtons: [...element.querySelectorAll("button")].filter(b => b.getClientRects().length && (b.getBoundingClientRect().width < 43 || b.getBoundingClientRect().height < 43)).length,
      animation: getComputedStyle(element.querySelector(".prescription-adjustment__preview")).animationName,
    }))
    assert.ok(geometry.body <= geometry.viewport && geometry.content <= geometry.contentWidth + 1, JSON.stringify(geometry))
    assert.equal(geometry.smallButtons, 0)
    if (scenario.motion === "reduce") assert.equal(geometry.animation, "none")
    const file = `${scenario.width}-${scenario.motion}-text${scenario.zoom}`
    await dialog.locator(".prescription-adjustment__preview").evaluate(async element => {
      for (const animation of element.getAnimations()) await animation.finished
    })
    await page.screenshot({ path: resolve(out, `editor-${file}.png`), fullPage: true })
    await dialog.getByRole("button", { name: "변경안 적용" }).click()
    await page.getByRole("status").filter({ hasText: "적용: C2" }).waitFor()
    assert.equal(await page.evaluate(() => localStorage.length), 0)

    await page.goto(`${root}/e2e/fixtures/workout-method-preview.html`)
    if (scenario.zoom === 2) await page.addStyleTag({ content: "html { font-size: 200% !important; }" })
    await page.locator(".plan-method-picker > summary").click()
    await page.getByRole("button", { name: "다른 훈련", exact: true }).click()
    await page.getByRole("button", { name: "본 방법 다시 보기", exact: true }).waitFor()
    assert.equal(await page.getByRole("button", { name: "계획 선택 확인" }).isDisabled(), true)
    assert.equal(await page.getByTestId("applies").innerText(), "변경 요청 0회")
    await page.getByRole("button", { name: "되돌리기", exact: true }).click()
    assert.equal(await page.getByRole("button", { name: "계획 선택 확인" }).isEnabled(), true)
    await page.getByRole("button", { name: "다시 하기", exact: true }).click()
    await page.locator(".plan-method-picker__preview").evaluate(async element => {
      for (const animation of element.getAnimations()) await animation.finished
    })
    await page.screenshot({ path: resolve(out, `picker-${file}.png`), fullPage: true })
    await page.getByRole("button", { name: "이 훈련으로 변경" }).click()
    assert.equal(await page.getByTestId("applies").innerText(), "변경 요청 1회")
    assert.equal(await page.getByRole("button", { name: "계획 선택 확인" }).isEnabled(), true)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.deepEqual(errors, [])
    results.push({ ...scenario, status: "PASS", geometry, clickToVisibleMsIncludingAutomation: Math.round(interactionMs) })
    await context.close()
  }
  let seed = 20260928
  for (let run = 0; run < 24; run++) {
    const context = await browser.newContext({ viewport: { width: run % 2 ? 375 : 320, height: 667 }, reducedMotion: run % 3 ? "no-preference" : "reduce" })
    const page = await context.newPage()
    await page.goto(`${root}/e2e/fixtures/workout-method-preview.html`)
    await page.locator(".plan-method-picker > summary").click()
    const actions = []
    for (let step = 0; step < 8; step++) {
      const available = []
      for (const name of ["다른 훈련", "본 방법 다시 보기", "되돌리기", "다시 하기", "처음 선택으로"]) {
        const button = page.getByRole("button", { name, exact: true })
        if (await button.count() && await button.isEnabled()) available.push({ name, target: button })
      }
      for (const radio of await page.locator(".plan-method-picker input[type=radio]").all()) {
        if (await radio.isVisible() && !(await radio.isChecked())) available.push({ name: await radio.locator("..").innerText(), target: radio })
      }
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      assert.ok(available.length > 0)
      const action = available[seed % available.length]
      await action.target.click()
      actions.push(action.name)
      assert.equal(await page.getByTestId("applies").innerText(), "변경 요청 0회")
      assert.equal(await page.evaluate(() => localStorage.length), 0)
    }
    const apply = page.getByRole("button", { name: "이 훈련으로 변경" })
    if (await apply.count()) { await apply.click(); assert.equal(await page.getByTestId("applies").innerText(), "변경 요청 1회") }
    interactionRuns.push({ run, actions, status: "PASS" })
    await context.close()
  }
  const evidence = { status: "PASS", boundary: "Synthetic UI fixtures, not live dose activation, independent human personas or account-storage proof", results, interactionRuns }
  await writeFile(resolve(out, "browser.json"), `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(JSON.stringify(evidence))
} finally { await browser.close() }
