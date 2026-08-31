import { expect, test } from "@playwright/test"

const DECORATION_KEY_V3 = "trainoracle.decorations.v3"

async function seedEntry(page: import("@playwright/test").Page, id: string, title: string) {
  await page.addInitScript(([idArg, titleArg]: readonly [string, string]) => {
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: idArg,
      kind: "post-session",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: titleArg,
      distanceKm: "5",
      durationMin: "30",
      avgPace: "6:00",
      rpe: 4,
      memo: "",
      fieldProvenance: {
        distanceKm: { provenance: "EXPLICIT" },
        durationMin: { provenance: "EXPLICIT" },
        avgPace: { provenance: "EXPLICIT" },
        rpe: { provenance: "EXPLICIT" },
      },
    }]))
  }, [id, title] as const)
}

async function openEditor(page: import("@playwright/test").Page, title: string) {
  await page.goto("/?app=1")
  await page.getByRole("button", { name: new RegExp(`${title}.*상세 열기`, "u") }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
}

/* P5 계약 §3 게이트 7 — 입력→붙이기→드래그→새로고침→재편집→삭제 전 과정. */
test("attaches, moves, re-edits and deletes a text sticker across a refresh", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  await seedEntry(page, "text-sticker-e2e", "Text sticker journey check")
  await page.setViewportSize({ width: 320, height: 568 })
  await openEditor(page, "Text sticker journey check")

  // 입력 시트: 20자 카운터와 잉크 스와치
  await page.getByRole("button", { name: "글 스티커 도구" }).click()
  const sheet = page.getByTestId("journal-text-sticker-sheet")
  await expect(sheet).toBeVisible()
  await page.getByTestId("journal-text-sticker-input").fill("오늘도 완주")
  await expect(page.getByTestId("journal-text-sticker-counter")).toHaveText("6/20")
  await page.getByRole("button", { name: "다홍 색" }).click()
  await page.getByTestId("journal-text-sticker-confirm").click()

  // 붙이기: 캔버스에 span 텍스트 노드로 렌더 (U7)
  const item = page.getByTestId("journal-decoration-item-0")
  await expect(item).toBeVisible()
  await expect(item).toHaveAttribute("aria-label", /글 스티커: 오늘도 완주/u)
  await expect(page.getByTestId("journal-decoration-asset-0")).toHaveText("오늘도 완주")

  // 드래그로 이동 → 저장 반영
  const before = await item.boundingBox()
  if (before === null) throw new Error("missing item box")
  await item.hover()
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2 + 60, before.y + before.height / 2 + 50, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw?.includes('"text":"오늘도 완주"') ?? false
  }, DECORATION_KEY_V3)).toBe(true)

  // 새로고침 후 유지
  await page.reload()
  await page.getByRole("button", { name: /Text sticker journey check.*상세 열기/u }).click()
  await expect(page.getByTestId("journal-decoration-asset-0")).toHaveText("오늘도 완주")

  // 재편집: 연필 손잡이 (U5 — 더블탭 대체 경로)
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByTestId("journal-decoration-item-0").click()
  await page.getByTestId("journal-decoration-edit-text-0").click()
  await expect(page.getByTestId("journal-text-sticker-sheet")).toBeVisible()
  await page.getByTestId("journal-text-sticker-input").fill("고친 글")
  await page.getByRole("button", { name: "보라 색" }).click()
  await page.getByTestId("journal-text-sticker-confirm").click()
  await expect(page.getByTestId("journal-decoration-asset-0")).toHaveText("고친 글")
  await expect.poll(() => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return (raw?.includes('"text":"고친 글"') ?? false) && (raw?.includes('"inkId":"TEXT_INK_VIOLET"') ?? false)
  }, DECORATION_KEY_V3)).toBe(true)

  // Undo로 이전 텍스트 복원 (U6)
  await page.getByRole("button", { name: "꾸미기 되돌리기" }).click()
  await expect(page.getByTestId("journal-decoration-asset-0")).toHaveText("오늘도 완주")

  // 삭제
  await page.getByTestId("journal-decoration-item-0").click()
  await page.getByRole("button", { name: "글 스티커 삭제" }).click()
  await expect(page.getByTestId("journal-decoration-item-0")).toHaveCount(0)
  await expect.poll(() => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw?.includes("TEXT_STICKER") ?? false
  }, DECORATION_KEY_V3)).toBe(false)

  expect(consoleErrors).toEqual([])
})

/* P5 계약 §3 게이트 6 — XSS 스모크: 마크업 입력이 텍스트 그대로 렌더된다. */
test("renders markup-looking input as inert text (XSS smoke)", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await seedEntry(page, "text-sticker-xss", "Text sticker xss check")
  await page.setViewportSize({ width: 320, height: 568 })
  await openEditor(page, "Text sticker xss check")

  await page.getByRole("button", { name: "글 스티커 도구" }).click()
  /* 20자 제한 안에 들어가는 마크업 페이로드 (T2와 충돌하지 않게). */
  const payload = "<img onerror=x()>"
  await page.getByTestId("journal-text-sticker-input").fill(payload)
  await page.getByTestId("journal-text-sticker-confirm").click()

  const asset = page.getByTestId("journal-decoration-asset-0")
  await expect(asset).toHaveText(payload)
  // 텍스트 노드로만 렌더 — 자식 요소가 생기면 안 된다
  expect(await asset.evaluate((node) => node.children.length)).toBe(0)
  expect(await page.locator(".decorated-journal-page__free-layer img").count()).toBe(0)
  expect(pageErrors).toEqual([])
})
