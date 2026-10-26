import { expect, test, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"

test.use({ serviceWorkers: "block" })

async function openOracle(page: Page) {
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "오라클", exact: true }).click()
  await expect(page.getByRole("region", { name: "기간별 훈련 리포트" })).toBeVisible()
}
const journalBytes = (page: Page) => page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => /journal/.test(key))))

test("four example stories retain view and period without journal writes; PNG is 1080 by 1350", async ({ page }, info) => {
  await openOracle(page)
  const before = await journalBytes(page)
  await page.getByRole("button", { name: "예시", exact: true }).click()
  const observations = new Set<string>()
  for (const scenario of ["첫 5km", "10km 준비", "트랙 훈련 1500m", "다시 시작"]) {
    await page.getByRole("group", { name: "예시 상황" }).getByRole("button", { name: scenario, exact: true }).click()
    for (const months of [3, 6]) {
      await page.getByRole("button", { name: `${months}개월`, exact: true }).click()
      await expect(page.getByRole("button", { name: `${months}개월`, exact: true })).toHaveAttribute("aria-pressed", "true")
      await expect(page.getByRole("button", { name: scenario, exact: true })).toHaveAttribute("aria-pressed", "true")
      observations.add((await page.locator(".oracle-report__observation h2").innerText()).trim())
      await page.getByRole("button", { name: "훈련량", exact: true }).click()
      const month = page.getByRole("group", { name: "근거를 볼 월 선택" }).getByRole("button").last()
      // Expanding the period and revisiting a view preserve in-range evidence.
      // Reach the desired open state without toggling a restored selection off.
      if (await month.getAttribute("aria-pressed") !== "true") await month.click()
      await expect(month).toHaveAttribute("aria-pressed", "true")
      const day = page.locator(".oracle-report__days > details").first()
      await expect(day).toBeVisible()
      if (await day.getAttribute("open") === null) await day.locator("summary").first().click()
      await expect(day).toHaveAttribute("open", "")
      const example = day.getByRole("button", { name: /예시 기록 보기/ }).first()
      if (await example.getAttribute("aria-expanded") !== "true") await example.click()
      await expect(example).toHaveAttribute("aria-expanded", "true")
      await expect(day).toContainText("가상 기록")
      await page.getByRole("button", { name: "훈련 요약", exact: true }).click()
      await expect(page.getByRole("button", { name: `${months}개월`, exact: true })).toHaveAttribute("aria-pressed", "true")
    }
  }
  expect(observations.size).toBeGreaterThanOrEqual(3)
  expect(await journalBytes(page)).toEqual(before)
  await page.getByRole("button", { name: "한 장으로 남기기", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "한 장으로 남기기" })
  await expect(dialog.getByRole("img")).toBeVisible()
  const downloaded = page.waitForEvent("download")
  await dialog.getByRole("button", { name: "이미지 저장", exact: true }).click()
  const download = await downloaded
  const file = info.outputPath("oracle-story.png")
  await download.saveAs(file)
  const bytes = await readFile(file)
  expect(bytes.subarray(1, 4).toString()).toBe("PNG")
  expect(bytes.readUInt32BE(16)).toBe(1080)
  expect(bytes.readUInt32BE(20)).toBe(1350)
  await page.keyboard.press("Escape")
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole("button", { name: "한 장으로 남기기", exact: true })).toBeFocused()
  expect(await journalBytes(page)).toEqual(before)
})

test("exact personal evidence returns to selected month and day", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 27, 12))
  await page.addInitScript(() => localStorage.setItem("trainoracle.journal.v1", JSON.stringify([
    { id: "oracle-story-exact", kind: "post-session", date: "2026-09-24", savedAt: "2026-09-24T08:00:00Z", syncState: "local", system: "base", title: "", memo: "", distanceKm: "5", durationMin: "30", avgPace: "6:00", rpe: 4,
      fieldProvenance: { system: { provenance: "EXPLICIT" }, distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" }, rpe: { provenance: "EXPLICIT" } } },
  ])))
  await openOracle(page)
  const before = await journalBytes(page)
  await page.getByRole("button", { name: "6개월", exact: true }).click()
  await page.getByRole("button", { name: "훈련량", exact: true }).click()
  await page.getByRole("button", { name: "9월 근거 보기", exact: true }).click()
  const day = page.locator(".oracle-report__days details").first()
  await day.locator("summary").first().click()
  const opener = day.getByRole("button", { name: "2026-09-24 운동 일지 보기" })
  await opener.click()
  await expect(page.locator(".oracle-report")).not.toBeVisible()
  await page.goBack()
  await expect(page.getByRole("button", { name: "6개월", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("button", { name: "9월 근거 보기", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(opener).toBeVisible()
  await expect(opener).toBeFocused()
  expect(await journalBytes(page)).toEqual(before)
})

test("responsive story controls remain reachable at narrow widths, large text and reduced motion", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await openOracle(page)
  await page.getByRole("button", { name: "예시", exact: true }).click()
  for (const width of [320, 375, 430, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    for (const box of await page.locator(".oracle-report__controls button, .oracle-report__scenarios button, .oracle-report__months button").evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })))) {
      expect(box.width).toBeGreaterThanOrEqual(43.9); expect(box.height).toBeGreaterThanOrEqual(43.9)
    }
    await page.screenshot({ path: info.outputPath(`oracle-story-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 375, height: 900 })
  await page.locator(".oracle-report").evaluate(root => {
    const rows = [root, ...root.querySelectorAll<HTMLElement>("*")].map(element => ({ element: element as HTMLElement, size: parseFloat(getComputedStyle(element).fontSize) }))
    rows.forEach(({ element, size }) => { element.style.fontSize = `${size * 2}px` })
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await expect(page.getByRole("button", { name: "다시 시작", exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath("oracle-story-200-percent-text.png"), fullPage: true })
})
