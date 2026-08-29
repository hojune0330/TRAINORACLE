import { expect, test } from "@playwright/test"

test("shows provenance-safe trends without leaking private memo signals", async ({ page }) => {
  const privateText = "P5_PRIVATE_MEMO_MUST_NEVER_RENDER"
  await page.addInitScript((secret) => {
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    const baseSession = {
      kind: "post-session",
      date,
      savedAt: `${date}T08:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "이지런",
      durationMin: "40",
      avgPace: "5:00",
      rpe: 4,
      memo: "",
    }
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([
      {
        ...baseSession,
        id: `explicit-p5-${"very-long-source-id-".repeat(12)}`,
        distanceKm: "8",
        fieldProvenance: {
          distanceKm: { provenance: "EXPLICIT" },
          durationMin: { provenance: "EXPLICIT" },
          avgPace: { provenance: "EXPLICIT" },
          rpe: { provenance: "EXPLICIT" },
        },
      },
      {
        ...baseSession,
        id: "legacy-p5",
        distanceKm: "12",
      },
      {
        ...baseSession,
        id: "imported-p5",
        distanceKm: "20",
        durationMin: "",
        avgPace: "",
        rpe: 0,
        fieldProvenance: {
          distanceKm: {
            provenance: "DERIVED",
            derivedFrom: ["import:activity-file"],
            derivationRuleId: "IMPORT_ACTIVITY_FILE_V1",
          },
          durationMin: { provenance: "MISSING" },
          avgPace: { provenance: "MISSING" },
          rpe: { provenance: "MISSING" },
        },
      },
      {
        ...baseSession,
        id: "private-memo-only",
        distanceKm: "",
        durationMin: "",
        avgPace: "",
        rpe: 0,
        memo: secret.repeat(4),
        memoPurpose: "PRIVATE_SELF_ONLY",
        fieldProvenance: {
          distanceKm: { provenance: "MISSING" },
          durationMin: { provenance: "MISSING" },
          avgPace: { provenance: "MISSING" },
          rpe: { provenance: "MISSING" },
        },
      },
      {
        id: "evening-p5",
        kind: "evening",
        date,
        savedAt: `${date}T20:00:00.000Z`,
        syncState: "local",
        sleepH: 0,
        sleepQuality: 0,
        weightKg: "",
        restingHr: "",
        painParts: { knee: 4 },
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
      },
    ]))
  }, privateText)

  await page.goto("/?app=1")
  const homeDistance = page.getByRole("region", { name: "내 달리기가 얼마나 쌓였을까요?" })
  await expect(homeDistance.getByText(/^8\s*km$/u).first()).toBeVisible()
  await homeDistance.getByRole("button", { name: "누적 거리 자세히 보기" }).click()

  const distance = page.getByRole("region", { name: "누적 거리와 변화" })
  await expect(distance.locator(".distance-overview__totals").getByText(/^8\s*km$/u).first()).toBeVisible()
  await expect(distance.getByText(/1건 반영/u).first()).toBeVisible()
  await expect(distance.getByText(/집계 기준에 맞지 않아 제외한 기록 2건/u).first()).toBeVisible()
  await distance.getByRole("button", { name: "12주" }).click()
  await distance.getByRole("button", { name: "12개월" }).click()
  await expect(distance.getByRole("button", { name: "12주" })).toHaveAttribute("aria-pressed", "true")
  await expect(distance.getByRole("button", { name: "12개월" })).toHaveAttribute("aria-pressed", "true")
  await expect(distance.getByRole("listitem", { name: new RegExp(`${new Date().getDate()}일, 8킬로미터`, "u") })).toBeVisible()

  const monthly = page.getByRole("region", { name: "최근 4개월 추이" })
  await expect(monthly.getByText(/중앙 페이스 5:00/u)).toBeVisible()
  await monthly.getByRole("button", { name: "기분" }).click()
  await expect(monthly.getByText(/중앙 기분 4\/5/u)).toBeVisible()
  await monthly.getByRole("button", { name: "통증" }).click()
  await expect(monthly.getByText(/중앙 통증 4\/5/u)).toBeVisible()
  await monthly.getByRole("button", { name: "거리" }).click()
  await expect(monthly.getByText(/중앙 거리 8 km/u)).toBeVisible()
  await expect(monthly.getByText(/집계 가능한 기록이 없어요/u).first()).toBeVisible()

  await expect(page.getByText(privateText, { exact: false })).toHaveCount(0)
  await expect(page.getByText(/기준:\s*데모|과다|통증·피로/u)).toHaveCount(0)
  expect(await page.evaluate(() => {
    const scrollRegion = document.querySelector<HTMLElement>(".app-scroll-region")
    return document.documentElement.scrollWidth <= window.innerWidth
      && (scrollRegion === null || scrollRegion.scrollWidth <= scrollRegion.clientWidth)
  })).toBe(true)
})
