import { expect, test } from "@playwright/test"

test("keeps a zero-point starter decoration on the real diary through refresh and undo", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  await page.addInitScript(() => {
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "zero-point-decoration-entry",
      kind: "post-session",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "Zero point decoration check",
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
  })

  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /Zero point decoration check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  await page.getByRole("button", { name: "맑은 날 오른쪽 위에 사용" }).click()

  await expect(page.getByTestId("journal-slot-top-corner")).toBeVisible()
  await expect(page.locator(".journal-decoration-toolbar")).toHaveAttribute("data-open", "false")
  await page.getByRole("button", { name: "꾸미기 완료" }).click()
  const reservedRailGeometry = await page.evaluate(() => {
    const sticker = document.querySelector<HTMLElement>('[data-testid="journal-slot-top-corner"]')
    const content = document.querySelector<HTMLElement>('[data-testid="decorated-journal-content"]')
    if (sticker === null || content === null) return null
    const stickerRect = sticker.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    return {
      stickerBottom: stickerRect.bottom,
      contentTop: contentRect.top,
      documentFits: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })
  expect(reservedRailGeometry).not.toBeNull()
  expect(reservedRailGeometry?.stickerBottom).toBeLessThanOrEqual(reservedRailGeometry?.contentTop ?? 0)
  expect(reservedRailGeometry?.documentFits).toBe(true)
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v2")
    return raw?.includes('"itemId":"STICKER_WEATHER_SUN"') ?? false
  })).toBe(true)

  await page.reload()
  await page.getByRole("button", { name: /Zero point decoration check.*상세 열기/u }).click()
  await expect(page.getByTestId("journal-slot-top-corner")).toBeVisible()

  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  await page.getByRole("button", { name: "맑은 날 제거" }).click()

  await expect(page.getByTestId("journal-slot-top-corner")).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v2")
    return raw?.includes('"itemId":"STICKER_WEATHER_SUN"') ?? false
  })).toBe(false)

  await page.getByRole("button", { name: "꾸미기 되돌리기" }).click()
  await expect(page.getByTestId("journal-slot-top-corner")).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v2")
    return raw?.includes('"itemId":"STICKER_WEATHER_SUN"') ?? false
  })).toBe(true)
  expect(consoleErrors).toEqual([])
})

test("keeps three emoji stickers in a reserved rail outside journal text", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "emoji-safe-rail-entry",
      kind: "post-session",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "Emoji safe rail check",
      distanceKm: "5",
      durationMin: "30",
      avgPace: "6:00",
      rpe: 4,
      memo: "긴 문장이 여러 줄로 바뀌어도 스티커가 이 글을 가리면 안 됩니다.",
      fieldProvenance: {
        distanceKm: { provenance: "EXPLICIT" },
        durationMin: { provenance: "EXPLICIT" },
        avgPace: { provenance: "EXPLICIT" },
        rpe: { provenance: "EXPLICIT" },
        memo: { provenance: "EXPLICIT" },
      },
    }]))
  })

  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /Emoji safe rail check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "이모지 스티커 도구" }).click()
  await page.getByRole("button", { name: "불꽃 이모지 붙이기" }).click()
  await page.getByRole("button", { name: "이모지 스티커 도구" }).click()
  await page.getByRole("button", { name: "메달 이모지 붙이기" }).click()
  await page.getByRole("button", { name: "이모지 스티커 도구" }).click()
  await page.getByRole("button", { name: "바나나 이모지 붙이기" }).click()

  await expect(page.getByTestId("journal-slot-body-sticker-1")).toBeVisible()
  await expect(page.getByTestId("journal-slot-body-sticker-2")).toBeVisible()
  await expect(page.getByTestId("journal-slot-body-sticker-3")).toBeVisible()
  await page.getByRole("button", { name: "꾸미기 완료" }).click()

  const geometry = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('[data-testid="decorated-journal-content"]')
    const rail = document.querySelector<HTMLElement>('[data-testid="journal-sticker-rail"]')
    const stickers = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="journal-slot-body-sticker-"]'))
    if (content === null || rail === null || stickers.length !== 3) return null
    const contentRect = content.getBoundingClientRect()
    const railRect = rail.getBoundingClientRect()
    return {
      contentBottom: contentRect.bottom,
      railTop: railRect.top,
      stickersInsideRail: stickers.every((sticker) => {
        const rect = sticker.getBoundingClientRect()
        return rect.top >= railRect.top && rect.bottom <= railRect.bottom
      }),
      railIgnoresPointers: getComputedStyle(rail).pointerEvents === "none",
      documentFits: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })

  expect(geometry).not.toBeNull()
  expect(geometry?.contentBottom).toBeLessThanOrEqual(geometry?.railTop ?? 0)
  expect(geometry?.stickersInsideRail).toBe(true)
  expect(geometry?.railIgnoresPointers).toBe(true)
  expect(geometry?.documentFits).toBe(true)
})

test("drags and resizes a decoration on the full-screen diary canvas and keeps it after refresh", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "free-decoration-entry",
      kind: "post-session",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "Free decoration movement check",
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
  })

  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /Free decoration movement check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  await page.getByRole("button", { name: "맑은 날 오른쪽 위에 사용" }).click()

  const movable = page.getByRole("button", { name: /맑은 날 선택됨/u })
  const start = await movable.boundingBox()
  expect(start).not.toBeNull()
  if (start === null) return
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 - 52, start.y + start.height / 2 + 64, { steps: 6 })
  await page.mouse.up()

  const moved = await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v2")
    const state = raw === null ? null : JSON.parse(raw) as { pagePlacements?: Array<{ transform?: { xPercent: number; yPercent: number } }> }
    return state?.pagePlacements?.[0]?.transform ?? null
  })).not.toBeNull()
  void moved

  const resize = page.getByRole("button", { name: "맑은 날 크기 조절" })
  const resizeBox = await resize.boundingBox()
  expect(resizeBox).not.toBeNull()
  if (resizeBox === null) return
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 36, resizeBox.y + resizeBox.height / 2 + 36, { steps: 5 })
  await page.mouse.up()

  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v2")
    const state = raw === null ? null : JSON.parse(raw) as { pagePlacements?: Array<{ transform?: { scale: number } }> }
    return state?.pagePlacements?.[0]?.transform?.scale ?? 0
  })).toBeGreaterThan(1)

  const savedTransform = await page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v2")
    const state = raw === null ? null : JSON.parse(raw) as { pagePlacements?: Array<{ transform?: unknown }> }
    return state?.pagePlacements?.[0]?.transform ?? null
  })
  await page.getByRole("button", { name: "꾸미기 완료" }).click()
  await page.reload()
  await page.getByRole("button", { name: /Free decoration movement check.*상세 열기/u }).click()
  await expect(page.locator(".decorated-journal-page__free-item--readonly")).toBeVisible()
  expect(await page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v2")
    const state = raw === null ? null : JSON.parse(raw) as { pagePlacements?: Array<{ transform?: unknown }> }
    return state?.pagePlacements?.[0]?.transform ?? null
  })).toEqual(savedTransform)
})

test("deletes a selected decoration on the canvas and deselects on empty-space tap", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "delete-decoration-entry",
      kind: "post-session",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "Canvas delete check",
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
  })

  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /Canvas delete check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  await page.getByRole("button", { name: "맑은 날 오른쪽 위에 사용" }).click()

  const movable = page.getByRole("button", { name: /맑은 날 선택됨/u })
  await expect(movable).toBeVisible()
  await movable.click()

  /* 44px 터치 계약: 삭제/회전/크기 손잡이의 히트 영역이 전부 44px 이상이어야 한다. */
  for (const name of ["맑은 날 삭제", "맑은 날 회전", "맑은 날 크기 조절"]) {
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
  await page.mouse.click(frameBox.x + 12, frameBox.y + frameBox.height / 2)
  await expect(page.getByRole("button", { name: "맑은 날 삭제" })).toHaveCount(0)

  /* 다시 선택 후 캔버스 위 삭제 → 저장소에서도 사라지고 되돌리기로 복구된다. */
  await movable.click()
  await page.getByRole("button", { name: "맑은 날 삭제" }).click()
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v2")
    const state = raw === null ? null : JSON.parse(raw) as { pagePlacements?: unknown[] }
    return state?.pagePlacements?.length ?? -1
  })).toBe(0)

  await page.getByRole("button", { name: "꾸미기 되돌리기" }).click()
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v2")
    const state = raw === null ? null : JSON.parse(raw) as { pagePlacements?: unknown[] }
    return state?.pagePlacements?.length ?? -1
  })).toBe(1)
})
