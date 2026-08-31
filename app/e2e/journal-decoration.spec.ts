import { expect, test } from "@playwright/test"

const DECORATION_KEY_V3 = "trainoracle.decorations.v3"
const DECORATION_KEY_V2 = "trainoracle.decorations.v2"
const DECORATION_KEY_V2_BACKUP = "trainoracle.decorations.v2-backup"

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

test("keeps a zero-point starter decoration on the real diary through refresh and undo", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  await seedEntry(page, "zero-point-decoration-entry", "Zero point decoration check")

  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /Zero point decoration check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  await page.getByRole("button", { name: "맑은 날 사용" }).click()

  await expect(page.getByTestId("journal-decoration-item-0")).toBeVisible()
  await expect(page.locator(".journal-decoration-toolbar")).toHaveAttribute("data-open", "false")
  await page.getByRole("button", { name: "꾸미기 완료" }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect.poll(() => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw?.includes('"itemId":"STICKER_WEATHER_SUN"') ?? false
  }, DECORATION_KEY_V3)).toBe(true)

  await page.reload()
  await page.getByRole("button", { name: /Zero point decoration check.*상세 열기/u }).click()
  await expect(page.getByTestId("journal-decoration-item-0")).toBeVisible()

  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  await page.getByRole("button", { name: "맑은 날 제거" }).click()

  await expect(page.getByTestId("journal-decoration-item-0")).toHaveCount(0)
  await expect.poll(() => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw?.includes('"itemId":"STICKER_WEATHER_SUN"') ?? false
  }, DECORATION_KEY_V3)).toBe(false)

  await page.getByRole("button", { name: "꾸미기 되돌리기" }).click()
  await expect(page.getByTestId("journal-decoration-item-0")).toBeVisible()
  await expect.poll(() => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw?.includes('"itemId":"STICKER_WEATHER_SUN"') ?? false
  }, DECORATION_KEY_V3)).toBe(true)
  expect(consoleErrors).toEqual([])
})

test("stacks three emoji stickers as free items without breaking the page layout", async ({ page }) => {
  await seedEntry(page, "emoji-free-stack-entry", "Emoji free stack check")

  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /Emoji free stack check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "이모지 스티커 도구" }).click()
  await page.getByRole("button", { name: "불꽃 이모지 붙이기" }).click()
  await page.getByRole("button", { name: "이모지 스티커 도구" }).click()
  await page.getByRole("button", { name: "메달 이모지 붙이기" }).click()
  await page.getByRole("button", { name: "이모지 스티커 도구" }).click()
  await page.getByRole("button", { name: "바나나 이모지 붙이기" }).click()

  await expect(page.getByTestId("journal-decoration-item-0")).toBeVisible()
  await expect(page.getByTestId("journal-decoration-item-1")).toBeVisible()
  await expect(page.getByTestId("journal-decoration-item-2")).toBeVisible()
  await page.getByRole("button", { name: "꾸미기 완료" }).click()

  /* v3 계약: 배열 순서 = z-순서, 세 항목이 모두 페이지 안에 있고 가로 스크롤이 없다. */
  const geometry = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>(".decorated-journal-page")
    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="journal-decoration-item-"]'))
    if (frame === null || items.length !== 3) return null
    const frameRect = frame.getBoundingClientRect()
    return {
      itemsInsideFrame: items.every((item) => {
        const rect = item.getBoundingClientRect()
        return rect.left >= frameRect.left - 1 && rect.right <= frameRect.right + 1
          && rect.top >= frameRect.top - 1 && rect.bottom <= frameRect.bottom + 1
      }),
      documentFits: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })

  expect(geometry).not.toBeNull()
  expect(geometry?.itemsInsideFrame).toBe(true)
  expect(geometry?.documentFits).toBe(true)

  const savedItemIds = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    const state = JSON.parse(raw) as { pages?: Array<{ items?: Array<{ itemId: string }> }> }
    return state.pages?.[0]?.items?.map((item) => item.itemId) ?? []
  }, DECORATION_KEY_V3)
  expect(savedItemIds).toEqual(["EMOJI_FIRE", "EMOJI_MEDAL", "EMOJI_BANANA"])
})

test("drags and resizes a decoration on the full-screen diary canvas and keeps it after refresh", async ({ page }) => {
  await seedEntry(page, "free-decoration-entry", "Free decoration movement check")

  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /Free decoration movement check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  await page.getByRole("button", { name: "맑은 날 사용" }).click()

  const movable = page.getByRole("button", { name: /맑은 날 선택됨/u })
  const start = await movable.boundingBox()
  expect(start).not.toBeNull()
  if (start === null) return
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 - 52, start.y + start.height / 2 + 64, { steps: 6 })
  await page.mouse.up()

  await expect.poll(() => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    const state = raw === null ? null : JSON.parse(raw) as { pages?: Array<{ items?: Array<{ transform?: { xPercent: number; yPercent: number } }> }> }
    return state?.pages?.[0]?.items?.[0]?.transform ?? null
  }, DECORATION_KEY_V3)).not.toBeNull()

  const resize = page.getByRole("button", { name: "맑은 날 크기 조절" })
  const resizeBox = await resize.boundingBox()
  expect(resizeBox).not.toBeNull()
  if (resizeBox === null) return
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 36, resizeBox.y + resizeBox.height / 2 + 36, { steps: 5 })
  await page.mouse.up()

  await expect.poll(() => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    const state = raw === null ? null : JSON.parse(raw) as { pages?: Array<{ items?: Array<{ transform?: { scale: number } }> }> }
    return state?.pages?.[0]?.items?.[0]?.transform?.scale ?? 0
  }, DECORATION_KEY_V3)).toBeGreaterThan(1)

  const savedTransform = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    const state = raw === null ? null : JSON.parse(raw) as { pages?: Array<{ items?: Array<{ transform?: unknown }> }> }
    return state?.pages?.[0]?.items?.[0]?.transform ?? null
  }, DECORATION_KEY_V3)
  await page.getByRole("button", { name: "꾸미기 완료" }).click()
  await page.reload()
  await page.getByRole("button", { name: /Free decoration movement check.*상세 열기/u }).click()
  await expect(page.locator(".decorated-journal-page__free-item--readonly")).toBeVisible()
  expect(await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    const state = raw === null ? null : JSON.parse(raw) as { pages?: Array<{ items?: Array<{ transform?: unknown }> }> }
    return state?.pages?.[0]?.items?.[0]?.transform ?? null
  }, DECORATION_KEY_V3)).toEqual(savedTransform)
})

test("deletes a selected decoration on the canvas and deselects on empty-space tap", async ({ page }) => {
  await seedEntry(page, "delete-decoration-entry", "Canvas delete check")

  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /Canvas delete check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  await page.getByRole("button", { name: "맑은 날 사용" }).click()

  const movable = page.getByRole("button", { name: /맑은 날 선택됨/u })
  await expect(movable).toBeVisible()
  await movable.click()

  /* 44px 터치 계약: 삭제/복제/회전/크기 손잡이의 히트 영역이 전부 44px 이상이어야 한다. */
  for (const name of ["맑은 날 삭제", "맑은 날 복제", "맑은 날 회전", "맑은 날 크기 조절"]) {
    const handle = page.getByRole("button", { name })
    const box = await handle.boundingBox()
    expect(box, `${name} bounding box`).not.toBeNull()
    if (box === null) continue
    expect(box.width, `${name} width`).toBeGreaterThanOrEqual(43)
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(43)
  }

  /* 빈 곳 탭 → 선택 해제되어 손잡이가 사라진다. */
  const frame = page.locator(".decorated-journal-page")
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()
  if (frameBox === null) return
  await page.mouse.click(frameBox.x + 12, frameBox.y + frameBox.height * 0.2)
  await expect(page.getByRole("button", { name: "맑은 날 삭제" })).toHaveCount(0)

  /* 다시 선택 후 캔버스 위 삭제 → 저장소에서도 사라지고 되돌리기로 복구된다. */
  await movable.click()
  await page.getByRole("button", { name: "맑은 날 삭제" }).click()
  await expect.poll(() => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    const state = raw === null ? null : JSON.parse(raw) as { pages?: Array<{ items?: unknown[] }> }
    return state?.pages?.[0]?.items?.length ?? 0
  }, DECORATION_KEY_V3)).toBe(0)

  await page.getByRole("button", { name: "꾸미기 되돌리기" }).click()
  await expect.poll(() => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    const state = raw === null ? null : JSON.parse(raw) as { pages?: Array<{ items?: unknown[] }> }
    return state?.pages?.[0]?.items?.length ?? 0
  }, DECORATION_KEY_V3)).toBe(1)
})

test("snaps a dragged decoration to the center guideline magnet", async ({ page }) => {
  await seedEntry(page, "pinch-decoration-entry", "Pinch gesture check")

  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /Pinch gesture check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  await page.getByRole("button", { name: "맑은 날 사용" }).click()

  const movable = page.getByRole("button", { name: /맑은 날 선택됨/u })
  await expect(movable).toBeVisible()

  /*
   * 핀치(두 손가락 크기+비틀기)는 합성 PointerEvent로는 use-gesture 경로를 안정적으로 못 탄다.
   * 계약: 실기기 QA 체크리스트 항목으로 검증한다 (마스터 플랜 §3 P2 검증 게이트).
   */

  /* 드래그로 50% 근처(±2%)에 놓으면 중앙 자석이 붙어 정확히 50에 저장된다. */
  const frame = page.locator(".decorated-journal-page")
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()
  if (frameBox === null) return
  const start = await movable.boundingBox()
  expect(start).not.toBeNull()
  if (start === null) return
  const targetX = frameBox.x + frameBox.width * 0.51
  const targetY = frameBox.y + frameBox.height * 0.51
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetX, targetY, { steps: 8 })
  /* 자석이 붙은 동안 가이드라인이 보인다. */
  await expect(page.getByTestId("journal-decoration-guides")).toBeVisible()
  await page.mouse.up()

  await expect.poll(() => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    const state = raw === null ? null : JSON.parse(raw) as { pages?: Array<{ items?: Array<{ transform?: { xPercent: number } }> }> }
    return state?.pages?.[0]?.items?.[0]?.transform?.xPercent ?? 0
  }, DECORATION_KEY_V3)).toBe(50)
})

test("migrates a v2-only decoration store to v3 on load and preserves the original as backup", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  await seedEntry(page, "v2-migration-entry", "V2 migration check")
  await page.addInitScript(([v2Key]: readonly [string]) => {
    const raw = window.localStorage.getItem("trainoracle.journal.v1")
    const entries = raw === null ? [] : JSON.parse(raw) as Array<{ date: string }>
    const date = entries[0]?.date ?? "2026-08-01"
    window.localStorage.setItem(v2Key, JSON.stringify({
      version: 2,
      spentPoints: 0,
      ownedItemIds: ["THEME_TRACK_NOTEBOOK", "INK_NAVY", "STICKER_WEATHER_SUN", "STAMP_REST_DAY", "TAPE_CHECKER"],
      equipped: { themeId: "THEME_TRACK_NOTEBOOK", inkId: "INK_NAVY", avatarId: null },
      library: { favoriteItemIds: [], recentItemIds: [] },
      pagePlacements: [{ date, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" }],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    }))
  }, [DECORATION_KEY_V2] as const)

  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /V2 migration check.*상세 열기/u }).click()

  /* v2 슬롯 배치가 v3 좌표로 이행되어 그대로 보인다. */
  await expect(page.getByTestId("journal-decoration-item-0")).toBeVisible()

  const migrated = await page.evaluate(([v3Key, v2Key, backupKey]: readonly [string, string, string]) => {
    const v3Raw = window.localStorage.getItem(v3Key)
    const state = v3Raw === null ? null : JSON.parse(v3Raw) as {
      version?: number
      pages?: Array<{ items?: Array<{ itemId: string; transform?: { xPercent: number; yPercent: number } }> }>
    }
    return {
      version: state?.version ?? null,
      firstItem: state?.pages?.[0]?.items?.[0] ?? null,
      v2Kept: window.localStorage.getItem(v2Key) !== null,
      backupCreated: window.localStorage.getItem(backupKey) !== null,
    }
  }, [DECORATION_KEY_V3, DECORATION_KEY_V2, DECORATION_KEY_V2_BACKUP] as const)

  expect(migrated.version).toBe(3)
  expect(migrated.firstItem).toMatchObject({
    itemId: "STICKER_WEATHER_SUN",
    transform: { xPercent: 86, yPercent: 14 },
  })
  /* 계약 §3: v2 원본 키는 지우지 않고, .v2-backup이 1회 생성된다. */
  expect(migrated.v2Kept).toBe(true)
  expect(migrated.backupCreated).toBe(true)
  expect(consoleErrors).toEqual([])
})
