import { expect, test } from "@playwright/test"

// 휴지통 30일 — 실제 브라우저에서 지우기 → 되돌리기 왕복이 되는지 확인한다.
// 단위 테스트가 통과해도 화면에서 눌러지지 않으면 사용자에게는 없는 기능이다.

const TRASH_KEY = "trainoracle.journal.trash.v1"

test("지운 일지를 그 자리에서 되돌릴 수 있다", async ({ page }) => {
  // Given — 일지 하나를 저장한다
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: /기록/u }).click()
  // 기록 탭은 곧바로 입력폼이 아니라 "어떤 일지를 쓰세요?" 선택 화면이다.
  // 종류를 먼저 골라야 입력폼이 나온다(스냅샷으로 확인).
  await page.getByRole("button", { name: /훈련 후/u }).first().click()
  // 실제 접근성 이름은 "세션 제목"이다(PostSessionForm.tsx). 추측한 이름(/훈련 이름|제목/)은
  // 아무 요소에도 걸리지 않아 e2e가 60초 타임아웃으로 죽었다.
  await page.getByRole("textbox", { name: "세션 제목" }).first().fill("휴지통 시험 훈련")
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: /^저장/u }).click()

  // 저장된 일지를 열어 삭제한다
  const saved = page.getByRole("button", { name: /훈련 후 .*상세 열기/u }).first()
  await expect(saved).toBeVisible()
  await saved.click()
  await page.keyboard.press("Escape")

  let nativeDialogCount = 0
  page.on("dialog", (dialog) => {
    nativeDialogCount += 1
    void dialog.dismiss()
  })

  const deleteButton = page.getByRole("button", { name: "이 일지 지우기" }).first()
  await deleteButton.click()

  const dialog = page.getByTestId("journal-delete-dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute("role", "alertdialog")
  const cancelButton = page.getByTestId("journal-delete-cancel")
  await expect(cancelButton).toBeFocused()
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 6000 })
  await expect(cancelButton).toBeFocused()
  expect(nativeDialogCount).toBe(0)

  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText("휴지통 시험 훈련")).toBeVisible()
  await expect(deleteButton).toBeFocused()

  await deleteButton.click()
  await dialog.click({ position: { x: 4, y: 4 } })
  await expect(dialog).toHaveCount(0)
  await expect(deleteButton).toBeFocused()

  await deleteButton.click()
  await page.getByTestId("journal-delete-confirm").click()

  // 되돌리기 버튼이 그 자리에 뜬다
  const undo = page.getByTestId("delete-undo-button")
  await expect(undo).toBeVisible()
  await expect(undo).toBeFocused()

  // 되돌리면 일지가 돌아온다
  await undo.click()
  await expect(page.getByTestId("delete-undo")).toHaveCount(0)
  await expect(page.getByText("휴지통 시험 훈련")).toBeVisible()
})

test("휴지통 화면에서 나중에도 되돌릴 수 있다", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")

  // Given — 휴지통에 항목이 있는 상태를 만든다 (스키마를 통과하는 일지)
  await page.evaluate((key) => {
    const entry = {
      id: "trash-e2e-1",
      kind: "post-session",
      date: "2026-07-20",
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local",
      system: "base",
      title: "휴지통에서 되돌릴 훈련",
      distanceKm: "8",
      durationMin: "45",
      avgPace: "5:30",
      rpe: 4,
      memo: "",
    }
    window.localStorage.setItem(key, JSON.stringify([
      { entry, deletedAt: new Date().toISOString() },
    ]))
  }, TRASH_KEY)

  await page.reload()

  // Then — 휴지통이 보이고 남은 일수가 표시된다
  const trash = page.getByTestId("trash-bin")
  await expect(trash).toBeVisible()
  await expect(page.getByTestId("trash-days-left")).toContainText("30일 남음")
  await expect(page.getByText("휴지통에서 되돌릴 훈련")).toBeVisible()

  // When — 되돌린다
  await page.getByTestId("trash-restore").first().click()

  // Then — 휴지통이 비고 일지가 돌아온다
  await expect(page.getByTestId("trash-bin")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /훈련 후 .*상세 열기/u }).first()).toBeVisible()
})

test("완전히 지우기는 확인을 한 번 더 받는다", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await page.evaluate((key) => {
    const entry = {
      id: "trash-e2e-2",
      kind: "post-session",
      date: "2026-07-20",
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local",
      system: "base",
      title: "완전 삭제 대상",
      distanceKm: "5",
      durationMin: "30",
      avgPace: "6:00",
      rpe: 3,
      memo: "",
    }
    window.localStorage.setItem(key, JSON.stringify([
      { entry, deletedAt: new Date().toISOString() },
    ]))
  }, TRASH_KEY)
  await page.reload()

  await expect(page.getByTestId("trash-bin")).toBeVisible()
  await page.getByTestId("trash-purge").first().click()

  // 한 번 눌렀다고 사라지면 안 된다 — 확인 단계가 있어야 한다
  const purgeConfirm = page.getByTestId("trash-purge-confirm")
  await expect(purgeConfirm).toBeVisible()
  await expect(purgeConfirm).toBeFocused()
  await expect(page.getByText("완전히 지우면 되돌릴 수 없어요.")).toBeVisible()
  await expect(page.getByText("완전 삭제 대상")).toBeVisible()

  // 취소하면 남아 있다
  await page.getByTestId("trash-purge-cancel").first().click()
  await expect(page.getByText("완전 삭제 대상")).toBeVisible()
  await expect(page.getByTestId("trash-purge")).toBeFocused()

  // 확인하면 사라진다
  await page.getByTestId("trash-purge").first().click()
  await page.getByTestId("trash-purge-confirm").first().click()
  await expect(page.getByTestId("trash-bin")).toHaveCount(0)
})

test("30일이 지난 항목은 앱을 켤 때 사라진다", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await page.evaluate((key) => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    const entry = {
      id: "trash-e2e-old",
      kind: "post-session",
      date: "2026-05-01",
      savedAt: "2026-05-01T09:00:00.000Z",
      syncState: "local",
      system: "base",
      title: "만료된 항목",
      distanceKm: "5",
      durationMin: "30",
      avgPace: "6:00",
      rpe: 3,
      memo: "",
    }
    window.localStorage.setItem(key, JSON.stringify([{ entry, deletedAt: old }]))
  }, TRASH_KEY)

  await page.reload()

  // 화면에 보이지 않고, 저장소에서도 실제로 비워진다
  await expect(page.getByTestId("trash-bin")).toHaveCount(0)
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), TRASH_KEY)
  expect(stored).toBe("[]")
})

test("메모만 쓴 일지가 안전 백업에서 빠진다는 안내가 뜬다", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")

  // Given — 수치 없이 메모만 있는 일지 2개 + 정상 일지 1개
  await page.evaluate(() => {
    const base = {
      kind: "post-session",
      date: "2026-07-20",
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local",
      system: "base",
      avgPace: "",
      memoPurpose: "PRIVATE_SELF_ONLY",
    }
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([
      { ...base, id: "ok1", title: "정상 일지", distanceKm: "8", durationMin: "45", rpe: 4, memo: "" },
      { ...base, id: "m1", title: "", distanceKm: "", durationMin: "", rpe: 0, memo: "마음이 무거웠다" },
      { ...base, id: "m2", title: "", distanceKm: "", durationMin: "", rpe: 0, memo: "잠이 안 왔다" },
    ]))
  })
  await page.reload()

  // Then — 빠지는 개수와 포함/전체 개수를 사실대로 알린다
  await page.getByRole("button", { name: "더보기" }).click()
  const notice = page.getByTestId("safe-export-skipped")
  await expect(notice).toBeVisible()
  await expect(notice).toContainText("2개")
  await expect(notice).toContainText("1개 포함")
  await expect(notice).toContainText("전체 3개")
  await expect(notice).toContainText("메모 포함 파일 내보내기")
})

test("빠지는 일지가 없으면 안내를 띄우지 않는다", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await page.evaluate(() => {
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([
      {
        id: "ok1", kind: "post-session", date: "2026-07-20",
        savedAt: "2026-07-20T09:00:00.000Z", syncState: "local",
        system: "base", title: "정상 일지", distanceKm: "8",
        durationMin: "45", avgPace: "", rpe: 4, memo: "",
      },
    ]))
  })
  await page.reload()
  await expect(page.getByTestId("safe-export-skipped")).toHaveCount(0)
})
