import { expect, type Locator, type Page } from "@playwright/test"

export const TOUCH_PROJECTS = new Set(["mobile-chromium", "touch-narrow"])

export type TouchTarget = {
  readonly name: string
  readonly locator: Locator
  readonly count?: number
  readonly heightOnly?: boolean
}

export function meetsTouchContract(width: number, height: number) {
  return width >= 44 && height >= 44
}

export async function openEntry(page: Page, entryName: RegExp) {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: /기록/u }).click()
  await page.getByRole("button", { name: entryName }).click()
}

export async function expectMinimumTouchHeight(target: Locator) {
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
}

export async function expectMinimumTouchSize(target: Locator) {
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  expect(meetsTouchContract(box?.width ?? 0, box?.height ?? 0)).toBe(true)
}

export async function auditTouchTargets(page: Page, targets: readonly TouchTarget[]) {
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth)
  for (const target of targets) {
    const expectedCount = target.count ?? 1
    await expect(target.locator, `${target.name} count`).toHaveCount(expectedCount)
    for (let index = 0; index < expectedCount; index += 1) {
      const item = target.locator.nth(index)
      await item.scrollIntoViewIfNeeded()
      const box = await item.boundingBox()
      expect(box, `${target.name}[${index}] box`).not.toBeNull()
      if (!box) continue
      console.log(`[TOUCH] name=${target.name}[${index}] width=${box.width} height=${box.height} x=${box.x} right=${box.x + box.width}`)
      expect(box.height, `${target.name}[${index}] height`).toBeGreaterThanOrEqual(44)
      if (!target.heightOnly) expect(box.width, `${target.name}[${index}] width`).toBeGreaterThanOrEqual(44)
      expect(box.x, `${target.name}[${index}] left clipping`).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width, `${target.name}[${index}] right clipping`).toBeLessThanOrEqual(viewportWidth + 0.5)
    }
  }
}

export async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
}

export async function expectSaveAboveNavigation(page: Page) {
  const save = page.getByRole("button", { name: /^저장/u })
  const navigation = page.getByRole("navigation", { name: "주 탭" })
  await save.scrollIntoViewIfNeeded()
  const saveBox = await save.boundingBox()
  const navigationBox = await navigation.boundingBox()
  expect(saveBox).not.toBeNull()
  expect(navigationBox).not.toBeNull()
  expect((saveBox?.y ?? 0) + (saveBox?.height ?? 0)).toBeLessThanOrEqual((navigationBox?.y ?? 0) + 0.5)
}

export async function seedTouchAuditEntries(page: Page) {
  await page.addInitScript(() => {
    const dateAt = (daysBack: number) => {
      const value = new Date()
      value.setDate(value.getDate() - daysBack)
      return value.toLocaleDateString("en-CA")
    }
    const date = dateAt(0)
    const savedAt = new Date().toISOString()
    localStorage.setItem("trainoracle.journal.v1", JSON.stringify([
      ...[21, 14, 7, 0].map((daysBack, index) => ({
        id: `__touch_audit_session_${index}__`, kind: "post-session", date: dateAt(daysBack), savedAt,
        syncState: "local", system: "lt", title: "터치 감사 템포런",
        distanceKm: String(5 * (2 ** index)), durationMin: "40", avgPace: "5'00", rpe: 6, memo: "",
        fieldProvenance: {
          distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" },
          avgPace: { provenance: "EXPLICIT" }, rpe: { provenance: "EXPLICIT" },
        },
      })),
      {
        id: "__touch_audit_evening__", kind: "evening", date, savedAt,
        syncState: "local", sleepH: 7.5, sleepQuality: 4, weightKg: "62.0",
        restingHr: "48", painParts: { "왼 무릎": 4 }, mood: 4,
        note: "터치 감사 컨디션", memoPurpose: "PRIVATE_SELF_ONLY",
        fieldProvenance: {
          sleepH: { provenance: "EXPLICIT" }, sleepQuality: { provenance: "EXPLICIT" },
          weightKg: { provenance: "EXPLICIT" }, restingHr: { provenance: "EXPLICIT" },
          painParts: { provenance: "EXPLICIT" }, mood: { provenance: "EXPLICIT" },
        },
      },
    ]))
  })
}
