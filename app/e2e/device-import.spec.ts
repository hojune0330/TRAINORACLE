// 실제 브라우저에서 워치 파일 가져오기 전체 경로를 확인한다.
//
// 계약 테스트(jsdom)와 달리 여기서 확인하는 것:
//  - 기록 탭 → "워치 기록 불러오기" 진입 경로가 실제로 이어져 있다.
//  - 브라우저 File API + DOMParser로 실제 TCX가 읽힌다(폴리필 아님).
//  - 저장 후 일지 목록·상세에 "가져옴" 배지가 붙는다.
//  - 가져온 기록은 홈 합계(주간 통계)에 들어가지 않는다.
import { expect, test } from "@playwright/test"

const JOURNAL_KEY = "trainoracle.journal.v1"

function tcxFor(date: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase><Activities><Activity Sport="Running">
  <Id>${date}T06:00:00Z</Id>
  <Lap StartTime="${date}T06:00:00Z">
    <TotalTimeSeconds>2400</TotalTimeSeconds>
    <DistanceMeters>8000</DistanceMeters>
  </Lap>
</Activity></Activities></TrainingCenterDatabase>`
}

async function openImport(page: import("@playwright/test").Page) {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: /기록/u }).click()
  await page.getByTestId("open-import").click()
  await expect(page.getByTestId("import-privacy-notice")).toBeVisible()
}

test("imports a watch TCX file into the local journal and marks its source", async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10)
  await openImport(page)

  // 자동 연동을 되는 척하지 않는다.
  await expect(page.getByTestId("oauth-status")).toContainText("아직 시점을 약속할 수 없어요")

  await page.getByLabel(/내보낸 활동 파일/u).setInputFiles({
    name: "garmin-activity.tcx",
    mimeType: "application/xml",
    buffer: Buffer.from(tcxFor(today), "utf-8"),
  })

  // 초안 확인 단계 — 사용자가 고르기 전엔 저장되지 않는다.
  await expect(page.getByTestId("import-draft-row")).toHaveCount(1)
  expect(await page.evaluate((key) => window.localStorage.getItem(key), JOURNAL_KEY)).toBeNull()
  await expect(page.getByText(/주간 통계·추이·훈련계획에는 들어가지 않아요/u)).toBeVisible()

  await page.getByRole("button", { name: /고른 1건 일지에 저장/u }).click()
  await expect(page.getByTestId("import-saved")).toContainText("1건을 일지에 저장했어요")

  // 출처가 파일 가져오기로, RPE는 미입력으로 남는다.
  const entry = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)[0]
  }, JOURNAL_KEY)
  expect(entry).toMatchObject({
    kind: "post-session",
    syncState: "local",
    distanceKm: "8.00",
    fieldProvenance: {
      distanceKm: { provenance: "DERIVED", derivedFrom: ["import:activity-file"] },
      rpe: { provenance: "MISSING" },
    },
  })
})

test("counts an imported journal without treating its numbers as analysis evidence", async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10)
  await openImport(page)
  await page.getByLabel(/내보낸 활동 파일/u).setInputFiles({
    name: "garmin-activity.tcx",
    mimeType: "application/xml",
    buffer: Buffer.from(tcxFor(today), "utf-8"),
  })
  await page.getByRole("button", { name: /고른 1건 일지에 저장/u }).click()
  await expect(page.getByTestId("import-saved")).toBeVisible()

  await page.getByRole("button", { name: "일지에서 확인하기" }).click()

  // 일지에는 보이고, 출처 배지가 붙는다.
  await expect(page.getByTestId("imported-chip").first()).toBeVisible()
  const services = page.getByRole("navigation", { name: "내 기록 살펴보기" })
  await expect(services.getByRole("button", { name: /^내 일지/u })).toContainText("1일 · 1개의 기록")
  await expect(services.getByRole("button", { name: /^분석/u })).toContainText("분석에 쓸 직접 입력 기록이 없어요")
})

test("shows a duplicate warning unchecked instead of merging silently", async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10)
  await openImport(page)
  const file = {
    name: "garmin-activity.tcx",
    mimeType: "application/xml",
    buffer: Buffer.from(tcxFor(today), "utf-8"),
  }

  await page.getByLabel(/내보낸 활동 파일/u).setInputFiles(file)
  await page.getByRole("button", { name: /고른 1건 일지에 저장/u }).click()
  await expect(page.getByTestId("import-saved")).toBeVisible()

  await page.getByRole("button", { name: "파일 더 가져오기" }).click()
  await page.getByLabel(/내보낸 활동 파일/u).setInputFiles(file)

  await expect(page.getByTestId("import-duplicate-flag")).toBeVisible()
  await expect(page.getByRole("checkbox")).not.toBeChecked()
  await expect(page.getByRole("button", { name: /저장할 활동을 골라 주세요/u })).toBeDisabled()

  const count = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw === null ? 0 : JSON.parse(raw).length
  }, JOURNAL_KEY)
  expect(count).toBe(1)
})

test("surfaces an unreadable file instead of failing silently", async ({ page }) => {
  await openImport(page)

  await page.getByLabel(/내보낸 활동 파일/u).setInputFiles({
    name: "not-an-activity.tcx",
    mimeType: "application/xml",
    buffer: Buffer.from("plain text, definitely not tcx", "utf-8"),
  })

  await expect(page.getByTestId("import-failure")).toContainText("기존 일지는 그대로 있어요")
  expect(await page.evaluate((key) => window.localStorage.getItem(key), JOURNAL_KEY)).toBeNull()
})
