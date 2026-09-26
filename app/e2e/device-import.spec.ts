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
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기" }).click()
  await page.getByTestId("open-import").click()
  await expect(page.getByTestId("import-privacy-notice")).toBeVisible()
}

test("imports a watch TCX file into the local journal and marks its source", async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10)
  await openImport(page)

  // 자동 연동 준비 상태는 보이고, 자세한 일정 안내는 눌러 확인한다.
  const integrationStatus = page.getByTestId("oauth-status")
  await expect(integrationStatus.locator("summary")).toHaveText("가민·WHOOP·스트라바 자동 연동은 준비 중이에요")
  await expect(integrationStatus.locator("details")).not.toHaveAttribute("open")
  await integrationStatus.locator("summary").click()
  await expect(integrationStatus).toContainText("시작 날짜는 아직 정해지지 않았어요")

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
    // Storage uses the canonical source value; display padding is not stored precision.
    distanceKm: "8",
    durationMin: "40",
    avgPace: "",
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

  // 월 목록과 달력을 거쳐 실제 날짜의 일지를 연다.
  const [year, month, day] = today.split("-").map(Number)
  const monthLabel = `${year}년 ${month}월`
  await page.getByRole("region", { name: "월별 기록" }).getByRole("button", { name: new RegExp(`^${monthLabel} `, "u") }).click()
  await expect(page.getByText("1일 · 1개 기록", { exact: true })).toBeVisible()
  await page.getByRole("grid", { name: `${monthLabel} 달력` }).getByRole("button", {
    name: new RegExp(`^${monthLabel} ${day}일 .*훈련 후 1건 일지 열기$`, "u"),
  }).click()
  await expect(page.getByTestId("imported-chip").first()).toBeVisible()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈", exact: true }).click()
  await expect(page.getByRole("button", { name: /기록 1개 보기/u })).toContainText("가져온 기록 포함")
  await page.getByRole("button", { name: "훈련 분석 보기", exact: true }).click()
  await expect(page.getByTestId("trends-analysis-exclusion").locator("summary")).toContainText("가져온 기록 1개")
  await page.getByTestId("trends-analysis-exclusion").locator("summary").click()
  await expect(page.getByTestId("trends-excluded-imported")).toContainText("외부 수치는 아직 분석에 넣지 않았어요")
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

  const checkbox = page.getByRole("checkbox")
  const label = checkbox.locator("..")
  await expect.poll(async () => (await label.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(44)
  await expect.poll(async () => (await label.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await label.click({ position: { x: 3, y: 22 } })
  await expect(checkbox).toBeChecked()
  await expect(page.getByRole("button", { name: "저장 방식을 골라 주세요" })).toBeDisabled()
  await page.getByRole("combobox").selectOption("separate")
  await page.getByRole("button", { name: /고른 1건 일지에 저장/u }).click()
  await expect(page.getByTestId("import-saved")).toContainText("새 일지 1건 저장")
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]").length, JOURNAL_KEY)).toBe(2)
})

test("reconciles a detailed continuation and keeps subjective editing available", async ({ page }, testInfo) => {
  await page.goto("/?app=1")
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await page.getByRole("button", { name: "운동을 마쳤어요" }).click()
  await page.getByRole("button", { name: "오후", exact: true }).click()
  await page.getByRole("button", { name: /RPE 6,/u }).click()
  await page.getByRole("button", { name: "없어요", exact: true }).click()
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
  await page.getByRole("button", { name: "일지 더 쓰기" }).click()
  await page.getByLabel("세션 제목").fill("Synthetic afternoon journal")
  await page.getByRole("button", { name: /수정 저장/u }).click()
  const original = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]")[0], JOURNAL_KEY)
  expect(original).toMatchObject({ captureDepth: "DETAILED", objectiveDataState: "WAITING", activitySlot: "PM" })

  await openImport(page)
  await page.getByLabel(/내보낸 활동 파일/u).setInputFiles({
    name: "synthetic-afternoon.tcx", mimeType: "application/xml", buffer: Buffer.from(tcxFor(original.date), "utf-8"),
  })
  await expect(page.getByRole("checkbox")).not.toBeChecked()
  await page.getByRole("checkbox").locator("..").click()
  await expect(page.getByRole("button", { name: "저장 방식을 골라 주세요" })).toBeDisabled()
  await page.getByRole("combobox").selectOption(original.id)
  await page.screenshot({ path: testInfo.outputPath("explicit-journal-reconciliation.png"), fullPage: true })
  await page.getByRole("button", { name: /고른 1건 일지에 저장/u }).click()
  await expect(page.getByTestId("import-saved")).toContainText("기존 일지 1건 보완")
  const merged = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), JOURNAL_KEY)
  expect(merged).toHaveLength(1)
  expect(merged[0]).toMatchObject({ id: original.id, distanceKm: "8", durationMin: "40", avgPace: "", rpe: 6, objectiveDataState: "CONFIRMED" })

  await page.goto("/?app=1")
  await page.getByRole("button", { name: "오늘 기록 보기", exact: true }).click()
  await page.getByTestId("journal-manage-toggle").click()
  await page.getByTestId(`journal-edit-${original.id}`).click()
  await expect(page.getByLabel("거리 (km)")).toHaveAttribute("readonly", "")
  await page.getByRole("button", { name: "7", exact: true }).click()
  await page.getByRole("button", { name: /수정 저장/u }).click()
  await page.reload()
  const edited = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), JOURNAL_KEY)
  expect(edited).toHaveLength(1)
  expect(edited[0]).toMatchObject({ id: original.id, distanceKm: "8", durationMin: "40", avgPace: "", rpe: 7 })
  expect(edited[0].fieldProvenance.distanceKm).toEqual(merged[0].fieldProvenance.distanceKm)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
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
