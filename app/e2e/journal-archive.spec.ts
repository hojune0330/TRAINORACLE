import { expect, test } from "@playwright/test"

test("drills month to week to day with provenance-safe summaries and return state", async ({ page }) => {
  const secret = "ARCHIVE_PRIVATE_MEMO_MUST_NOT_RENDER"
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  await page.addInitScript((privateText) => {
    const explicit = {
      id: "archive-explicit",
      kind: "post-session",
      date: "2026-07-10",
      savedAt: "2026-07-10T09:00:00.000Z",
      syncState: "local",
      system: "base",
      title: "archive session",
      distanceKm: "6",
      durationMin: "30",
      avgPace: "5:00",
      rpe: 4,
      memo: "",
      fieldProvenance: {
        distanceKm: { provenance: "EXPLICIT" },
        durationMin: { provenance: "EXPLICIT" },
        avgPace: { provenance: "EXPLICIT" },
        rpe: { provenance: "EXPLICIT" },
      },
    }
    const imported = {
      ...explicit,
      id: "archive-imported",
      date: "2026-07-11",
      savedAt: "2026-07-11T09:00:00.000Z",
      title: "imported record",
      distanceKm: "10",
      durationMin: "50",
      avgPace: "",
      rpe: 0,
      fieldProvenance: {
        distanceKm: {
          provenance: "DERIVED",
          derivedFrom: ["import:activity-file"],
          derivationRuleId: "IMPORT_ACTIVITY_FILE_V1",
        },
        durationMin: {
          provenance: "DERIVED",
          derivedFrom: ["import:activity-file"],
          derivationRuleId: "IMPORT_ACTIVITY_FILE_V1",
        },
        avgPace: { provenance: "MISSING" },
        rpe: { provenance: "MISSING" },
      },
    }
    const privateMemoOnly = {
      ...explicit,
      id: "archive-private",
      date: "2026-07-09",
      savedAt: "2026-07-09T09:00:00.000Z",
      title: "",
      distanceKm: "",
      durationMin: "",
      avgPace: "",
      rpe: 0,
      memo: privateText.repeat(8),
      memoPurpose: "PRIVATE_SELF_ONLY",
      fieldProvenance: {
        distanceKm: { provenance: "MISSING" },
        durationMin: { provenance: "MISSING" },
        avgPace: { provenance: "MISSING" },
        rpe: { provenance: "MISSING" },
      },
    }
    const evening = {
      id: "archive-evening",
      kind: "evening",
      date: "2026-07-10",
      savedAt: "2026-07-10T21:00:00.000Z",
      syncState: "local",
      sleepH: 0,
      sleepQuality: 0,
      weightKg: "",
      restingHr: "",
      painParts: { calf: 3 },
      mood: 4,
      note: "",
      fieldProvenance: {
        sleepH: { provenance: "MISSING" },
        sleepQuality: { provenance: "MISSING" },
        weightKg: { provenance: "MISSING" },
        restingHr: { provenance: "MISSING" },
        painParts: { provenance: "EXPLICIT" },
        mood: { provenance: "EXPLICIT" },
      },
    }
    const race = {
      id: "archive-race",
      kind: "race",
      date: "2026-07-12",
      savedAt: "2026-07-12T12:00:00.000Z",
      syncState: "local",
      stage: "post",
      record: "50:00",
      rank: "3",
      result: "result",
      memo: "",
    }
    window.localStorage.setItem(
      "trainoracle.journal.v1",
      JSON.stringify([explicit, imported, privateMemoOnly, evening, race]),
    )
  }, secret)

  await page.goto("/?app=1&uitest=1")
  await page.getByRole("button", { name: "전체 보기" }).click()

  const archive = page.getByTestId("journal-archive")
  await expect(archive.getByRole("heading", { name: "지난 일지" })).toBeVisible()
  await expect(archive.getByText(secret, { exact: false })).toHaveCount(0)
  await expect(archive.getByText("출처를 확인할 수 없어 제외된 기록 1건")).toBeVisible()
  const month = archive.getByRole("button", { name: /2026년 7월.*훈련 후 3건.*6 km.*30분.*제외된 기록 1건/u })
  await expect(month).toBeVisible()
  await expect(month).not.toContainText("10 km")
  await expect(month).not.toContainText("50분")
  expect((await archive.ariaSnapshot()).includes(secret)).toBe(false)

  await month.click()
  await archive.getByRole("button", { name: /7월 6일.*7월 12일/u }).click()
  await expect(archive.getByRole("heading", { name: "7월 6일–12일" })).toBeVisible()
  await expect(archive.getByRole("button", { name: /2026년 7월 9일.*훈련 후 1건/u })).toBeVisible()
  await archive.getByRole("button", { name: /2026년 7월 10일.*훈련 후 1건.*6 km.*30분/u }).click()
  await expect(page.getByText("archive session")).toBeVisible()
  await page.getByRole("button", { name: "뒤로" }).click()

  await expect(archive.getByRole("heading", { name: "7월 6일–12일" })).toBeVisible()
  await expect(archive.getByRole("button", { name: /2026년 7월 10일/u })).toBeVisible()
  await expect(archive.getByText(secret, { exact: false })).toHaveCount(0)
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 393, height: 852 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(archive.getByRole("heading", { name: "7월 6일–12일" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  expect(consoleErrors).toEqual([])
})
