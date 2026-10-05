import { expect, test } from "@playwright/test"
import { stateFixture } from "../src/domain/plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "../src/domain/planned-session-link"

test.use({ serviceWorkers: "block" })

for (const width of [375, 320, 1024]) test(`coaching reader preserves original plan and home return at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 667 })
  await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  const state = stateFixture()
  const draft = createPlannedSessionLogDraft(state, state.activePlan.sessions[0]!, "2026-07-24T01:00:00.000Z")!
  await page.addInitScript(({ state, draft }) => {
    localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(state))
    localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "synthetic-coaching", kind: "post-session", date: draft.date, savedAt: "2026-07-24T02:00:00.000Z", syncState: "local",
      activityOutcome: "PARTIAL", activitySlot: "AM", planExecutionRelation: "MODIFIED", plannedSessionLink: draft.link,
      system: "", title: "", distanceKm: "3.2", durationMin: "18", avgPace: "", rpe: 7,
      fieldProvenance: { rpe: { provenance: "EXPLICIT" }, distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" } }, memo: "", painCheckStatus: "NO_SIGNAL_REPORTED",
    }]))
  }, { state, draft })
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto("/?app=1&uitest=1")
  const before = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
  const open = page.getByRole("button", { name: /일부만 한 훈련/ })
  await open.scrollIntoViewIfNeeded()
  const scroll = await page.locator(".app-scroll-region").evaluate(el => el.scrollTop)
  await open.click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("tab", { name: "요약" })).toHaveAttribute("aria-selected", "true")
  await expect(dialog.getByRole("heading", { name: "당시 계획한 훈련" })).toHaveCount(0)
  await expect(dialog.getByText("읽기만 해서는 일정이 바뀌지 않아요.")).toBeVisible()
  const body = dialog.locator(".plan-day-reader__body")
  expect(await body.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
  const action = dialog.getByRole("button", { name: "현재 일정", exact: true })
  expect((await action.boundingBox())!.y + (await action.boundingBox())!.height).toBeLessThanOrEqual(667)
  await page.screenshot({ path: testInfo.outputPath(`coaching-summary-${width}.png`) })
  await dialog.getByRole("button", { name: "다음 내용" }).click()
  await expect(dialog.getByRole("heading", { name: "당시 계획한 훈련" })).toBeVisible()
  await expect(dialog.getByRole("heading", { name: "실제로 남긴 기록" })).toBeVisible()
  await dialog.getByRole("tab", { name: "이유" }).click()
  await expect(dialog.getByText(/어느 반복이나 구간을 마쳤는지는/)).toBeVisible()
  await dialog.getByText("사용한 기록", { exact: true }).click()
  await expect(dialog.getByText("계획한 강도: RPE 2~4.")).toBeVisible()
  await dialog.getByRole("tab", { name: "요약" }).click()
  if (width === 320) await dialog.evaluate(el => {
    const nodes = [el, ...el.querySelectorAll<HTMLElement>("h2,h3,h4,p,li,summary,button,dt,dd,strong,small")]
    const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize))
    nodes.forEach((node, index) => (node as HTMLElement).style.fontSize = `${sizes[index]! * 2}px`)
  })
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await dialog.locator(".plan-day-reader__body").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await expect(action).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath(`coaching-${width}.png`) })
  await page.goBack()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "훈련 코칭", exact: true })).toBeFocused()
  expect(await page.locator(".app-scroll-region").evaluate(el => Math.abs(el.scrollTop))).toBeCloseTo(scroll, 0)
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(before)
  expect(errors).toEqual([])
})

test("coaching pages accept swipes but do not hijack vertical scrolling or buttons", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  const state = stateFixture()
  const draft = createPlannedSessionLogDraft(state, state.activePlan.sessions[0]!, "2026-07-24T01:00:00.000Z")!
  await page.addInitScript(({ state, draft }) => {
    localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(state))
    localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "synthetic-swipe", kind: "post-session", date: draft.date, savedAt: "2026-07-24T02:00:00Z", syncState: "local",
      activityOutcome: "COMPLETED", activitySlot: "AM", planExecutionRelation: "AS_PLANNED", plannedSessionLink: draft.link,
      system: "", title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "",
    }]))
  }, { state, draft })
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("button", { name: /계획과 실제 기록/ }).click()
  const dialog = page.getByRole("dialog")
  const body = dialog.locator(".plan-day-reader__body")
  const swipe = async (dx: number, dy: number) => {
    const start = { identifier: 1, clientX: 280, clientY: 240 }
    const end = { identifier: 1, clientX: 280 + dx, clientY: 240 + dy }
    await body.dispatchEvent("touchstart", { touches: [start], changedTouches: [start] })
    await body.dispatchEvent("touchmove", { touches: [end], changedTouches: [end] })
    await body.dispatchEvent("touchend", { touches: [], changedTouches: [end] })
  }
  await swipe(-120, 10)
  await expect(dialog.getByRole("tab", { name: "계획·기록" })).toHaveAttribute("aria-selected", "true")
  await swipe(-15, -180)
  await expect(dialog.getByRole("tab", { name: "계획·기록" })).toHaveAttribute("aria-selected", "true")
  await swipe(120, 10)
  await expect(dialog.getByRole("tab", { name: "요약" })).toHaveAttribute("aria-selected", "true")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await dialog.getByRole("tab", { name: "요약" }).focus()
  await page.keyboard.press("ArrowRight")
  await expect(dialog.getByRole("tab", { name: "계획·기록" })).toBeFocused()
  expect(await dialog.getByRole("tabpanel").evaluate(el => getComputedStyle(el).animationName)).toBe("none")
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
})
