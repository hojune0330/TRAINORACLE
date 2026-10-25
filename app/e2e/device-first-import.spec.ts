import { expect, test } from "@playwright/test"

const JOURNAL_KEY = "to-local-journal.journal.v2"
const row = { date: "2026-10-16", sport: "running", distanceKm: "5.000125", durationMin: "25.0125" }
const input = Buffer.from(JSON.stringify([row]) + " ".repeat(70_000))

async function openImport(page: import("@playwright/test").Page) {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기" }).click()
  await page.getByTestId("open-import").click()
}

test("larger JSON is parsed in a real worker on the device and saved only on confirmation", async ({ page }) => {
  const writes: string[] = []
  page.on("request", request => { if (request.method() === "POST") writes.push(request.url()) })
  await openImport(page)
  const started = page.waitForEvent("worker")
  await page.getByLabel("가져올 운동 파일 선택", { exact: true }).setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: input })
  const worker = await started
  expect(worker.url()).toMatch(/activity-file\.worker/)
  await expect(page.getByTestId("import-draft-row")).toHaveCount(1)
  expect(await page.evaluate(key => localStorage.getItem(key), JOURNAL_KEY)).toBeNull()
  await page.getByRole("button", { name: /고른 1건 일지에 저장/u }).click()
  await expect(page.getByTestId("import-saved")).toBeVisible()
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "[]"), JOURNAL_KEY)
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({ date: row.date, distanceKm: row.distanceKm, durationMin: row.durationMin })
  expect(writes).toEqual([])
})

test("cancelling a worker load cannot show its late result or replace a new file", async ({ page }) => {
  await openImport(page)
  let resume!: () => void
  const hold = new Promise<void>(resolve => { resume = resolve })
  let requested!: () => void
  const request = new Promise<void>(resolve => { requested = resolve })
  await page.route(/activity-file\.worker.*\.(?:js|ts)(?:\?|$)/, async route => { requested(); await hold; await route.continue().catch(() => {}) })
  await page.getByLabel("가져올 운동 파일 선택", { exact: true }).setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: input })
  await request
  try {
    await page.getByRole("button", { name: /취소/u }).click()
    await page.getByLabel("가져올 운동 파일 선택", { exact: true }).setInputFiles({ name: "replacement.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify([{ ...row, distanceKm: "3" }])) })
    await expect(page.getByTestId("import-draft-row")).toHaveCount(1)
  } finally { resume() }
  await page.getByRole("button", { name: /고른 1건 일지에 저장/u }).click()
  await expect(page.getByTestId("import-saved")).toBeVisible()
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "[]"), JOURNAL_KEY)
  expect(saved).toHaveLength(1)
  expect(saved[0].distanceKm).toBe("3")
})
