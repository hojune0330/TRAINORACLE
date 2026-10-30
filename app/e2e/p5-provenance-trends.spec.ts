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
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "오라클", exact: true }).click()
  const detailMenu = page.getByRole("group", { name: "훈련 분석 자세히 보기" })
  await detailMenu.getByRole("button", { name: "훈련량", exact: true }).click()

  const distance = page.getByRole("region", { name: "기간별 훈련 리포트" })
  await expect(distance.getByRole("img", { name: /월별 누적 거리.*8 km/u })).toBeVisible()
  await distance.locator("summary", { hasText: "집계 기준·출처" }).click()
  await expect(distance.getByText(/거리 합계: 반영 1건 · 제외 2건/u)).toBeVisible()
  await distance.getByRole("button", { name: "6개월", exact: true }).click()
  await expect(distance.getByRole("button", { name: "6개월", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(distance.getByRole("group", { name: "근거를 볼 월 선택" }).getByRole("button")).toHaveCount(6)
  await expect(distance.getByRole("region", { name: "리포트 근거" }).getByText(/^8 km$/u)).toBeVisible()

  const monthly = distance
  await detailMenu.getByRole("button", { name: "월별 변화", exact: true }).click()
  const selectMetric = async (label: string) => {
    await monthly.getByRole("button", { name: /^지표 선택:/u }).click()
    await page.getByRole("dialog", { name: "볼 지표 선택" }).getByRole("button", { name: label, exact: true }).click()
    await expect(page.getByRole("dialog", { name: "볼 지표 선택" })).toHaveCount(0)
    await expect(monthly.getByRole("button", { name: `지표 선택: ${label}`, exact: true })).toBeVisible()
  }
  await selectMetric("페이스")
  await expect(monthly.getByRole("img", { name: /페이스 · 월별 중앙값.*5:00/u })).toBeVisible()
  await selectMetric("기분")
  await expect(monthly.getByRole("img", { name: /기분 · 월별 중앙값.*4\/5/u })).toBeVisible()
  await selectMetric("통증")
  await expect(monthly.getByRole("img", { name: /통증 · 월별 중앙값.*4\/5/u })).toBeVisible()
  await selectMetric("거리")
  await expect(monthly.getByRole("img", { name: /거리 · 월별 중앙값.*8 km/u })).toBeVisible()
  await expect(monthly.getByRole("img", { name: /거리 · 월별 중앙값.*미기록/u })).toBeVisible()

  await expect(page.getByText(privateText, { exact: false })).toHaveCount(0)
  await expect(page.getByText(/기준:\s*데모|과다|통증·피로/u)).toHaveCount(0)
  expect(await page.evaluate(() => {
    const scrollRegion = document.querySelector<HTMLElement>(".app-scroll-region")
    return document.documentElement.scrollWidth <= window.innerWidth
      && (scrollRegion === null || scrollRegion.scrollWidth <= scrollRegion.clientWidth)
  })).toBe(true)
})
