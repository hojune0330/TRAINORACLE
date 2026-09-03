import { expect, test } from "@playwright/test"
import { stateFixture } from "../src/domain/plan-beta-store.test-fixture"
import { createExplanationReceipt } from "../src/domain/training-explanation-receipt"
import { undersizedInteractiveTargets } from "./touch-audit"

test.use({ serviceWorkers: "block" })

for (const legacy of [false, true]) {
  test(`${legacy ? "legacy" : "version-bound"} explanation is readable and returns to the same session`, async ({ page }, testInfo) => {
    if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({ width: 375, height: 667 })
    const state = stateFixture()
    const seed = legacy ? state : { ...state, explanationReceipt: createExplanationReceipt(state.activePlan, state.generatedAt) }
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.addInitScript((plan) => {
      if (localStorage.getItem("trainoracle.plan-beta.v1") === null) localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(plan))
    }, seed)
    await page.goto("/?app=1")
    await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
    const trigger = page.getByRole("button", { name: "이 훈련을 하는 이유", exact: true }).first()
    await trigger.scrollIntoViewIfNeeded()
    const before = await page.locator(".app-scroll-region").evaluate(node => node.scrollTop)
    const stored = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
    await trigger.click()
    const reader = page.getByRole("dialog")
    await expect(reader).toBeVisible()
    await expect(reader.getByRole("tab", { name: "방법", exact: true })).toHaveAttribute("aria-selected", "true")
    await expect(reader.getByText("운동과 회복 순서", { exact: true })).toBeVisible()
    const box = await reader.boundingBox()
    expect(box?.width).toBeCloseTo(page.viewportSize()!.width, 1)
    expect(box?.height).toBeCloseTo(page.viewportSize()!.height, 1)
    const metric = await reader.locator(".session-explanation__metric").textContent()
    await reader.getByLabel("전문 보기").check()
    expect(await reader.locator(".session-explanation__metric").textContent()).toBe(metric)
    await reader.getByRole("tab", { name: "이유·근거" }).click()
    await expect(reader.getByText(legacy ? /복원한 것은 아니에요/u : "저장된 처방과 설명 버전이 일치해요.")).toBeVisible()
    for (const heading of ["훈련 목적", "몸이 에너지를 공급하는 방식", "거리·시간·강도·반복을 이렇게 정한 이유", "회복을 이렇게 넣은 이유", "이번 주기에서 맡는 역할", "기대하는 변화와 한계", "실제로 사용한 내 정보", "연구·코칭 근거"]) {
      await expect(reader.getByRole("heading", { name: heading, exact: true })).toBeAttached()
    }
    await reader.locator(".session-explanation__term > summary").click()
    await expect(reader.getByRole("link", { name: /용어집에서 더 읽기/u })).toBeVisible()
    await expect.poll(() => undersizedInteractiveTargets(reader)).toEqual([])
    await reader.getByRole("tab", { name: "주기·기록" }).click()
    await expect(reader.getByText(/미기록을 0이나 훈련 실패로 계산하지 않아요/u)).toBeAttached()
    await reader.getByRole("tab", { name: "주기·기록" }).press("Home")
    await expect(reader.getByRole("tab", { name: "방법", exact: true })).toBeFocused()
    const originalTabFont = await reader.getByRole("tab", { name: "방법", exact: true }).evaluate(node => parseFloat(getComputedStyle(node).fontSize))
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    expect(await reader.getByRole("tab", { name: "방법", exact: true }).evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(originalTabFont * 1.9)
    await expect.poll(() => reader.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await expect.poll(() => reader.locator(".session-explanation__content").evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await reader.getByRole("tab", { name: "이유·근거" }).click()
    await expect(reader.getByRole("heading", { name: "훈련 목적", exact: true })).toBeAttached()
    await reader.locator(".session-explanation__content").evaluate(node => node.scrollTop = 0)
    await page.screenshot({ path: testInfo.outputPath(`explanation-${legacy ? "legacy" : "bound"}-200pct.png`) })
    await page.evaluate(() => { document.documentElement.style.fontSize = "" })
    await reader.getByRole("button", { name: "훈련 일정으로 돌아가기" }).click()
    await expect(reader).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(await page.locator(".app-scroll-region").evaluate(node => node.scrollTop)).toBeCloseTo(before, 0)
    await trigger.click()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(stored)
    expect(errors).toEqual([])
  })
}
