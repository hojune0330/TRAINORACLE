import { expect, test } from "@playwright/test"

/*
 * P6 검증 게이트 (마스터 플랜 §3-21, §0): CPU 4x throttle에서 드래그 중 30fps 이상.
 * CDP는 chromium 전용이라 desktop-chromium 프로젝트에서만 측정한다.
 */

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

test("sustains 30fps while dragging a decoration under 4x CPU throttle", async ({ page }) => {
  /* 성능 트레이스는 기준 환경 1곳에서만 측정 — 4개 프로젝트 중복 측정은 CI 낭비다. */
  test.skip(test.info().project.name !== "desktop-chromium", "성능 측정은 desktop-chromium 기준 환경 전용")

  await seedEntry(page, "perf-drag-entry", "Perf drag check")
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /Perf drag check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "이모지 스티커 도구" }).click()
  await page.getByRole("button", { name: "불꽃 이모지 붙이기" }).click()

  const item = page.getByTestId("journal-decoration-item-0")
  await expect(item).toBeVisible()

  /* 저사양 조건: CPU 4x throttle (마스터 플랜 §0 합격선). */
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })

  /* rAF 간격 수집기 — 드래그 동안 프레임 간격(ms)을 기록한다. */
  await page.evaluate(() => {
    const intervals: number[] = []
    let previous = performance.now()
    let running = true
    const tick = (now: number) => {
      intervals.push(now - previous)
      previous = now
      if (running) requestAnimationFrame(tick)
    }
    requestAnimationFrame((now) => {
      previous = now
      requestAnimationFrame(tick)
    })
    ;(window as unknown as Record<string, unknown>).__stopFrameProbe = () => {
      running = false
      return intervals
    }
  })

  const box = await item.boundingBox()
  if (box === null) throw new Error("missing item box")
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  /* 60스텝 왕복 드래그 ≈ 1초 이상의 연속 조작 부하. */
  for (let step = 0; step < 30; step += 1) {
    await page.mouse.move(startX + step * 3, startY + step * 2)
  }
  for (let step = 30; step > 0; step -= 1) {
    await page.mouse.move(startX + step * 3, startY + step * 2)
  }
  await page.mouse.up()

  const intervals = await page.evaluate(() => (
    (window as unknown as { __stopFrameProbe: () => number[] }).__stopFrameProbe()
  ))
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 })

  /* 합격선: 평균 33.4ms 이하(30fps) + 프레임의 90% 이상이 50ms(20fps 바닥) 이내. */
  expect(intervals.length).toBeGreaterThan(10)
  const average = intervals.reduce((total, value) => total + value, 0) / intervals.length
  const under50 = intervals.filter((value) => value <= 50).length / intervals.length
  expect(average).toBeLessThanOrEqual(33.4)
  expect(under50).toBeGreaterThanOrEqual(0.9)

  /* 드래그가 실제로 커밋됐는지 확인 — 성능 측정이 조작을 깨뜨리지 않았다는 방증. */
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v3")
    return raw?.includes("EMOJI_FIRE") ?? false
  })).toBe(true)
})
