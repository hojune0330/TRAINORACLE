import { test, expect, type Page } from "@playwright/test"
import { advanceTreadmill, nearestHazard, newTreadmillRun, treadmillCommand, TREADMILL_STAGES } from "../src/domain/minigame/treadmill"
import type { TreadmillStage, TreadmillState } from "../src/domain/minigame/treadmill"
import { tourCity, tourStages } from "../src/domain/minigame/tour"

async function openGame(page: Page, course: "practice" | "seoul" = "practice", blockToriArt = false, blockSceneArt = false) {
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    if (blockToriArt && url.pathname.endsWith("/tori-atlas-v1.webp")) return route.abort()
    if (blockSceneArt && url.pathname.includes("/game/seoul-v1/")) return route.abort()
    return url.hostname === "127.0.0.1" || url.protocol === "data:" ? route.continue() : route.abort()
  })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
  await expect(page.getByRole("heading", { name: "러닝 투어", exact: true })).toBeVisible()
  if (course === "practice") await page.getByRole("button", { name: "러닝머신 연습" }).click()
  else await page.getByRole("button", { name: /^서울/ }).click()
  await page.clock.install()
  // Keep simulated time fixed between input calls, including slow mobile screenshots.
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 100)
}
const energy = async (page: Page) => Number((await page.getByLabel("게임 에너지", { exact: true }).textContent())!.replace(/\D/g, ""))
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

async function screenPointer(page: Page, touch: boolean) {
  const session = touch ? await page.context().newCDPSession(page) : null
  return {
    down: async (x: number, y: number) => {
      if (session) await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] })
      else { await page.mouse.move(x, y); await page.mouse.down() }
    },
    move: async (x: number, y: number) => {
      if (session) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 1 }] })
      else await page.mouse.move(x, y)
    },
    up: async () => {
      if (session) await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      else await page.mouse.up()
    },
    cancel: async () => {
      if (session) await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] })
      else await page.mouse.up()
    },
  }
}

test("hazards enter at the screen edge and stay continuous when a scheduled obstacle activates", async ({ page }, info) => {
  await openGame(page, "seoul")
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(3050)
  await page.keyboard.down("ArrowRight")
  const stages = tourStages(tourCity("seoul")!)
  let model = { ...treadmillCommand(newTreadmillRun(stages), { type: "start", stages }), countdown: 0, running: true }
  const field = page.locator("canvas.treadmill-game__canvas")
  type Seen = { id: number; x: number; scheduled: boolean }
  let previous: Seen[] = [], sawPreview = false, activated = false
  const seenIds = new Set<number>()
  // The third course entry activates at 7.2s; include its approach as well.
  for (let tick = 0; tick < 95; tick++) {
    if (tick === 0 || tick === 27) { await page.keyboard.press("d"); model = treadmillCommand(model, { type: "dash" }) }
    const ahead = nearestHazard(model)
    if (ahead && ahead.x - model.x < 0.15 && model.y === 0) {
      await page.keyboard.press("Space"); model = treadmillCommand(model, { type: "jump" })
    }
    await page.clock.runFor(100)
    model = advanceTreadmill(model, 0.1)
    const visible = JSON.parse((await field.getAttribute("data-rendered-hazards"))!) as Seen[]
    for (const hazard of visible) {
      if (!seenIds.has(hazard.id)) { expect(hazard.x, "first sight must be at the right edge, not mid-lane").toBeGreaterThan(0.94); seenIds.add(hazard.id) }
      const before = previous.find(item => item.id === hazard.id)
      if (before) expect(Math.abs(hazard.x - before.x)).toBeLessThan(0.09)
      if (before?.scheduled && !hazard.scheduled) activated = true
      if (hazard.scheduled && hazard.x < 0.95 && !sawPreview) {
        sawPreview = true
        await page.screenshot({ path: info.outputPath("approaching-obstacle.png"), fullPage: true })
      }
    }
    previous = visible
  }
  await page.keyboard.up("ArrowRight")
  expect(sawPreview).toBe(true)
  expect(activated).toBe(true)
  expect(seenIds.size).toBeGreaterThanOrEqual(3)
})

test("camera follows with slack, accelerates on dash, freezes on pause and keeps notices off the runner", async ({ page }, info) => {
  await openGame(page, "seoul")
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(3100)
  const field = page.locator("canvas.treadmill-game__canvas")
  const value = async (name: string) => Number(await field.getAttribute(`data-${name}`))
  const start = await value("camera-offset"), startX = await value("runner-x")
  await page.keyboard.down("ArrowRight"); await page.clock.runFor(500)
  expect(await value("camera-offset")).not.toBeCloseTo(start, 3)
  expect(await value("runner-x")).not.toBeCloseTo(startX, 3)
  const travel = await value("scene-travel")
  await page.clock.runFor(200)
  const normalDistance = await value("scene-travel") - travel
  await page.keyboard.press("d"); await page.clock.runFor(100)
  const dashTravel = await value("scene-travel")
  await page.clock.runFor(200)
  expect(await value("scene-travel") - dashTravel).toBeGreaterThan(normalDistance * 1.3)
  await page.keyboard.press("Space"); await page.clock.runFor(200)
  const bounds = (await field.boundingBox())!
  const hud = (await page.locator(".treadmill-game__hud").boundingBox())!
  expect(hud.y + hud.height).toBeLessThan(bounds.y + bounds.height * await value("runner-y") - 75)
  await page.screenshot({ path: info.outputPath("camera-dash-jump.png"), fullPage: true })
  await page.setViewportSize({ width: 800, height: 360 })
  await page.clock.runFor(200)
  const wide = (await field.boundingBox())!, wideHud = (await page.locator(".treadmill-game__hud").boundingBox())!
  expect(wideHud.y + wideHud.height).toBeLessThan(wide.y + wide.height * await value("runner-y") - 65)
  await page.screenshot({ path: info.outputPath("camera-landscape-jump.png"), fullPage: true })
  await page.getByRole("button", { name: "일시정지", exact: true }).click()
  const stoppedTravel = await value("scene-travel"), stoppedOffset = await value("camera-offset")
  await page.clock.runFor(1000)
  expect(await value("scene-travel")).toBe(stoppedTravel)
  expect(await value("camera-offset")).toBe(stoppedOffset)
  await page.keyboard.up("ArrowRight")
})

test("camera keeps the moving city and hazard lane clear at thirteen seconds", async ({ page }, info) => {
  await openGame(page, "seoul")
  await page.getByRole("button", { name: "시작", exact: true }).click()
  let now = 0
  for (const step of planRun(tourStages(tourCity("seoul")!)).filter(step => step.at <= 16_000)) {
    await page.clock.runFor(Math.round(step.at - now)); now = step.at
    if (step.key === "run-down") await page.keyboard.down("ArrowRight")
    if (step.key === "run-up") await page.keyboard.up("ArrowRight")
    if (step.key === "jump") await page.keyboard.press("Space")
  }
  await page.clock.runFor(Math.round(16_000 - now))
  await expect(page.getByLabel("경기 진행 시간")).toHaveText("13 / 90초")
  const canvas = page.locator("canvas.treadmill-game__canvas"), bounds = (await canvas.boundingBox())!
  const foot = bounds.y + bounds.height * Number(await canvas.getAttribute("data-runner-y"))
  for (const selector of [".treadmill-game__warning", ".treadmill-game__gesture-hint", ".treadmill-game__wave"]) {
    const box = (await page.locator(selector).boundingBox())!
    expect(box.y + box.height).toBeLessThan(foot - 75)
  }
  await page.screenshot({ path: info.outputPath("camera-city-13s.png"), fullPage: true })
  await page.keyboard.up("ArrowRight")
})

test("gestures fill the viewport and hold, swipe up diagonally and double tap without action buttons", async ({ page }, info) => {
  await openGame(page, "seoul")
  const field = page.locator("canvas.treadmill-game__canvas")
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(3100)
  const bounds = (await field.boundingBox())!, viewport = page.viewportSize()!
  expect(bounds.height).toBeGreaterThan(viewport.height * 0.75)
  expect(bounds.y + bounds.height).toBeGreaterThan(viewport.height - 12)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height)
  expect(await noSideScroll(page)).toBe(true)
  await expect(page.locator(".treadmill-game__controls, .treadmill-game__note")).toHaveCount(0)
  const pointer = await screenPointer(page, info.project.name === "phone")
  const x = bounds.x + bounds.width * 0.55, y = bounds.y + bounds.height * 0.72
  await pointer.down(x, y); await page.clock.runFor(800)
  await expect(field).toHaveAttribute("data-running", "true")
  const drained = await energy(page)
  expect(drained).toBeLessThan(100)
  await pointer.up(); await page.clock.runFor(250)
  expect(await energy(page)).toBeGreaterThan(drained)
  await expect(field).toHaveAttribute("data-running", "false")
  for (const [index, dx] of [0, -45, 45].entries()) {
    await pointer.down(x, y)
    await pointer.move(x + dx, y - 55)
    await expect(field).toHaveAttribute("data-jumps", String(index + 1))
    await pointer.move(x + dx, y - 90)
    await expect(field).toHaveAttribute("data-jumps", String(index + 1))
    // A normal jump is about 0.82 seconds: land before starting the next swipe.
    await page.clock.runFor(1000); await pointer.up()
  }
  await pointer.down(x, y); await pointer.up(); await pointer.down(x, y); await pointer.up()
  await expect(field).toHaveAttribute("data-dashes", "1")
  await pointer.down(x, y); await pointer.up(); await pointer.down(x, y); await pointer.up()
  await expect(field).toHaveAttribute("data-dashes", "1")
  await page.screenshot({ path: info.outputPath("full-screen-gestures.png"), fullPage: true })
  await page.setViewportSize({ width: 800, height: 360 })
  await page.clock.runFor(20)
  const rotated = (await field.boundingBox())!
  expect(rotated.y + rotated.height).toBeLessThanOrEqual(360)
  expect(rotated.y + rotated.height).toBeGreaterThan(348)
  expect(await noSideScroll(page)).toBe(true)
  await page.getByRole("button", { name: /게임 메뉴/ }).click()
  await page.getByRole("button", { name: "게임 계속하기", exact: true }).click()
  await page.screenshot({ path: info.outputPath("landscape-gestures.png"), fullPage: true })
})

test("gestures release on cancellation and never cross pause or menu boundaries", async ({ page }, info) => {
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(3100)
  const field = page.locator("canvas.treadmill-game__canvas"), bounds = (await field.boundingBox())!
  const pointer = await screenPointer(page, info.project.name === "phone")
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height * 0.65
  await pointer.down(x, y); await pointer.move(x + 60, y + 20)
  await expect(field).toHaveAttribute("data-jumps", "0")
  await pointer.cancel(); await page.clock.runFor(100)
  await expect(field).toHaveAttribute("data-running", "false")
  await pointer.down(x, y)
  await page.evaluate(() => window.dispatchEvent(new Event("blur")))
  await pointer.up()
  await expect(field).toHaveAttribute("data-running", "false")
  await page.getByRole("button", { name: "계속", exact: true }).click()
  await page.clock.runFor(1100)
  await page.getByRole("button", { name: /게임 메뉴/ }).click()
  await page.getByRole("button", { name: "게임 계속하기", exact: true }).click()
  await page.clock.runFor(1100)
  await pointer.down(x, y); await page.clock.runFor(100)
  await expect(field).toHaveAttribute("data-running", "true")
  await expect(field).toHaveAttribute("data-dashes", "0")
  await pointer.up()
})

test("home launch banner opens the game, returns home and stays acknowledged after reload", async ({ page }, info) => {
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort())
  await page.goto("/?app=1")
  const banner = page.getByRole("complementary", { name: "새 소식" })
  await expect(banner).toBeVisible()
  const record = await page.getByRole("button", { name: "오늘 운동 기록 쓰기", exact: true }).boundingBox()
  const notice = await banner.boundingBox()
  expect(record!.y + record!.height).toBeLessThan(notice!.y)
  expect(await noSideScroll(page)).toBe(true)
  await page.screenshot({ path: info.outputPath("home-launch-banner.png"), fullPage: true })
  await banner.getByRole("button", { name: "게임하기" }).click()
  await expect(page.getByRole("heading", { name: "러닝 투어", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "홈으로 돌아가기" }).click()
  await expect(page.getByRole("button", { name: "오늘 운동 기록 쓰기", exact: true })).toBeVisible()
  await expect(banner).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole("button", { name: "더보기", exact: true })).toBeVisible()
  await expect(banner).toHaveCount(0)
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
  await page.getByRole("button", { name: "더보기로 돌아가기" }).click()
  await expect(page.getByRole("heading", { name: "더보기", exact: true })).toBeVisible()
})

test("closing the launch banner preserves the journal action and stays closed", async ({ page }) => {
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort())
  await page.goto("/?app=1")
  await page.getByRole("button", { name: "러닝 투어가 열렸어요 안내 닫기" }).click()
  await expect(page.getByRole("button", { name: "오늘 운동 기록 쓰기", exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("button", { name: "더보기", exact: true })).toBeVisible()
  await expect(page.getByRole("complementary", { name: "새 소식" })).toHaveCount(0)
})

test("a delayed frame keeps playing without catching up the stall", async ({ page }) => {
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(3100)
  await page.keyboard.down("ArrowRight")
  const before = await energy(page)
  // One late RAF callback, as when mobile rendering stalls, not 900ms of normal frames.
  await page.clock.fastForward(900)
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-mode", "running")
  expect(before - await energy(page)).toBeLessThan(3)
  await page.clock.runFor(800)
  expect(await energy(page)).toBeLessThan(before)
  await page.keyboard.up("ArrowRight")
})

test("touch-style empty focus does not pause but hidden page freezes and releases input", async ({ page }) => {
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(3100)
  await page.locator("canvas.treadmill-game__canvas").evaluate(element => (element as HTMLElement).blur())
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-mode", "running")
  const run = page.locator("canvas.treadmill-game__canvas")
  await run.hover(); await page.mouse.down(); await page.clock.runFor(300)
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-mode", "paused")
  const frozen = await energy(page)
  await page.clock.fastForward(5000)
  expect(await energy(page)).toBe(frozen)
  await page.evaluate(() => {
    delete (document as unknown as { hidden?: boolean }).hidden
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await page.mouse.up()
  await page.getByRole("button", { name: "계속", exact: true }).click()
  await page.clock.runFor(400)
  await expect(run).toHaveAttribute("data-running", "false")
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-mode", "running")
})

for (const blocked of [false, true]) test(`Tori atlas ${blocked ? "failure keeps the fallback playable" : "loads and is painted in the running game"}`, async ({ page }, info) => {
  await page.addInitScript(() => {
    const target = window as unknown as Window & { __toriAtlasPaints: number }
    target.__toriAtlasPaints = 0
    const original = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (image: CanvasImageSource, ...coordinates: number[]) {
      if (image instanceof HTMLImageElement && image.src.endsWith("/tori-atlas-v1.webp") && image.naturalWidth === 1024) target.__toriAtlasPaints++
      return Reflect.apply(original, this, [image, ...coordinates])
    }
  })
  await openGame(page, "practice", blocked)
  const paints = () => page.evaluate(() => (window as unknown as Window & { __toriAtlasPaints: number }).__toriAtlasPaints)
  if (!blocked) await expect.poll(paints).toBeGreaterThan(0)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(3100)
  await page.keyboard.down("ArrowRight")
  await page.clock.runFor(700)
  await page.keyboard.up("ArrowRight")
  await expect(page.getByLabel("게임 에너지", { exact: true })).not.toHaveText("에너지 100")
  await page.screenshot({ path: info.outputPath(blocked ? "tori-fallback-running.png" : "tori-atlas-running.png"), fullPage: true })
  await page.getByRole("button", { name: "일시정지", exact: true }).click()
  await expect(page.getByRole("button", { name: "계속", exact: true })).toBeVisible()
  if (blocked) expect(await paints()).toBe(0)
  await page.screenshot({ path: info.outputPath(blocked ? "tori-fallback.png" : "tori-atlas.png"), fullPage: true })
})

type Step = { at: number; key: "run-down" | "run-up" | "jump" | "upgrade" }
/**
 * Plans one human-like run with the same pure engine the app uses (hold to a target, keep a reserve,
 * jump when the next hazard is close). The browser then replays it with real keys, so the test
 * proves the screen, input and clock wiring, not a shortcut into game state.
 */
function planRun(stages: readonly TreadmillStage[] = TREADMILL_STAGES): Step[] {
  const steps: Step[] = []
  let state: TreadmillState = treadmillCommand(newTreadmillRun(stages), { type: "start", stages })
  let ms = 0
  for (let frame = 0; frame < 7000 && (state.mode === "running" || state.mode === "upgrade"); frame++) {
    if (state.mode === "upgrade") {
      steps.push({ at: ms, key: "upgrade" })
      state = treadmillCommand(state, { type: "upgrade", upgrade: "economy" })
    }
    const want = (state.x < 0.45 && state.energy > 25) || (state.x < 0.22 && state.energy > 0)
    if (want !== state.running) { steps.push({ at: ms, key: want ? "run-down" : "run-up" }); state = treadmillCommand(state, { type: "run", held: want }) }
    const ahead = nearestHazard(state)
    if (ahead && ahead.x - state.x < 0.09 && state.y === 0 && state.energy >= state.jumpCost) {
      steps.push({ at: ms, key: "jump" }); state = treadmillCommand(state, { type: "jump" })
    }
    state = advanceTreadmill(state, 1 / 60); ms += 1000 / 60
  }
  expect(state.mode, "the planned run must clear in the pure engine").toBe("clear")
  return steps
}

test("explains the rules before play, falls on inaction and restarts with pointer recovery", async ({ page }) => {
  const scripts: string[] = []
  page.on("request", request => { if (request.resourceType() === "script") scripts.push(request.url()) })
  await openGame(page)
  // This Chromium build has no WebGPU adapter, so the game paints its own sky and never downloads the shader library.
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-sky", "canvas")
  expect(scripts.filter(url => /typegpu|shaders_js|[/]shaders[/]/u.test(url))).toEqual([])
  // ...and that sky is really painted: the top-left pixel of the game canvas is opaque.
  expect(await page.locator("canvas.treadmill-game__canvas").evaluate(canvas => {
    const element = canvas as HTMLCanvasElement
    return element.getContext("2d")!.getImageData(4, 4, 1, 1).data[3]
  })).toBe(255)
  await expect(page.getByRole("heading", { name: "90초 러닝 챌린지" })).toBeVisible()
  await expect(page.getByRole("navigation")).toHaveCount(0)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(1000)
  await page.keyboard.press("Space")
  await expect(page.locator("canvas.treadmill-game__canvas")).toHaveAttribute("data-jumps", "0")
  await page.clock.runFor(10000)
  await expect(page.getByRole("heading", { name: "트랙에서 뒤로 떨어졌어요" })).toBeVisible()
  await page.getByText("이번 판 기록").click()
  await expect(page.getByText(/^버틴 시간/)).toBeVisible()
  await expect(page.getByText(/손을 놓으세요|다시 달리세요|미리 쉬어 두세요/)).toBeVisible()
  // Stage 1 failure: the one primary action is a full retry.
  await page.getByRole("button", { name: "다시 도전", exact: true }).click()
  await page.clock.runFor(3100)
  const run = page.locator("canvas.treadmill-game__canvas")
  await run.hover(); await page.mouse.down(); await page.clock.runFor(1500)
  await expect(run).toHaveAttribute("data-running", "true")
  const before = await energy(page)
  await page.mouse.up(); await page.clock.runFor(600)
  await expect(run).toHaveAttribute("data-running", "false")
  expect(await energy(page)).toBeGreaterThan(before)
  await page.getByRole("button", { name: "일시정지", exact: true }).click()
  await expect(page.getByRole("button", { name: "계속", exact: true })).toBeVisible()
  const frozen = await page.getByLabel("경기 진행 시간").textContent()
  await page.clock.runFor(2000)
  await expect(page.getByLabel("경기 진행 시간")).toHaveText(frozen!)
  await page.getByRole("button", { name: "투어 지도로" }).click()
  await page.getByRole("button", { name: "저장 없이 나가기" }).click()
  await page.getByRole("button", { name: "더보기로 돌아가기" }).click()
  await expect(page.getByRole("heading", { name: "더보기", exact: true })).toBeVisible()
  await page.clock.runFor(10000)
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
  await page.getByRole("button", { name: "러닝머신 연습" }).click()
  await expect(page.getByLabel("게임 에너지", { exact: true })).toHaveText("에너지 100")
  await expect(page.getByRole("button", { name: "시작", exact: true })).toBeVisible()
})

test("clears three stages with real keys, shows trade-offs and resets the build", async ({ page }, info) => {
  test.setTimeout(180_000) // Real input replay of the longer 90-second course.
  await openGame(page)
  const plan = planRun()
  await page.getByRole("button", { name: "시작", exact: true }).click()
  let now = 0, checkpoints = 0
  for (const step of plan) {
    if (step.at > now) { await page.clock.runFor(Math.round(step.at - now)); now = step.at }
    if (step.key === "run-down") await page.keyboard.down("ArrowRight")
    else if (step.key === "run-up") await page.keyboard.up("ArrowRight")
    else if (step.key === "jump") await page.keyboard.press("Space")
    else {
      if (checkpoints === 0) {
        await expect(page.getByRole("heading", { name: "이번 판의 능력을 바꿔요" })).toBeVisible()
        await expect(page.locator("[data-upgrade]")).toHaveCount(0)
        await page.screenshot({ path: info.outputPath("upgrade-intro.png"), fullPage: true })
      }
      await page.clock.runFor(2500)
      await expect(page.getByRole("heading", { name: "어떤 능력을 키울까요?" })).toBeVisible()
      await expect(page.getByText("대신 회복과 대시 충전이 느려요")).toBeVisible()
      const time = await page.getByLabel("경기 진행 시간").textContent()
      await page.clock.runFor(2000)
      await expect(page.getByLabel("경기 진행 시간")).toHaveText(time!)
      if (checkpoints === 0) {
        await expect(page.getByText("추천", { exact: true })).toBeVisible()
        expect(await noSideScroll(page)).toBe(true)
        await page.screenshot({ path: info.outputPath("checkpoint.png"), fullPage: true })
      }
      // One tap: the pick starts the next stage; its name is announced during a short still countdown.
      await page.getByRole("button", { name: /일정한 박자/ }).click()
      await expect(page.getByRole("heading", { name: "어떤 능력을 키울까요?" })).toHaveCount(0)
      await expect(page.getByRole("list", { name: `코스 ${checkpoints + 2}/3 · ${checkpoints === 0 ? "진흙" : "가시밭"}` })).toBeVisible()
      await expect(page.getByRole("button", { name: "계속", exact: true })).toHaveCount(0)
      await expect(page.getByText("일정한 박자 장착!", { exact: true })).toBeVisible()
      checkpoints += 1
    }
  }
  // The planned run ends exactly on the finish; leave a little time for frame-boundary drift.
  await page.clock.runFor(1200)
  await page.keyboard.up("ArrowRight")
  await expect(page.getByRole("heading", { name: "세 구간 완주!" })).toBeVisible()
  await page.getByText("이번 판 기록").click()
  await expect(page.getByText("강화: 일정한 박자 · 일정한 박자")).toBeVisible()
  await page.screenshot({ path: info.outputPath("clear.png"), fullPage: true })
  await page.getByRole("button", { name: "처음부터" }).click()
  await expect(page.getByRole("list", { name: "코스 1/3 · 트랙" })).toBeVisible()
  await expect(page.getByText(/^강화:/)).toHaveCount(0)
  await expect(page.getByLabel("게임 에너지", { exact: true })).toHaveText("에너지 100")
})

test("focus loss pauses, Esc pauses, and reduced motion preserves movement and controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(3100)
  await page.keyboard.down("ArrowRight"); await page.clock.runFor(500); await page.keyboard.up("ArrowRight")
  await page.keyboard.press("d")
  await expect(page.getByLabel("게임 에너지", { exact: true })).not.toHaveText("에너지 100")
  await expect(page.locator("canvas.treadmill-game__canvas")).toHaveAttribute("data-dashes", "1")
  await page.keyboard.press("d")
  await expect(page.locator("canvas.treadmill-game__canvas")).toHaveAttribute("data-dashes", "1")
  await page.evaluate(() => window.dispatchEvent(new Event("blur")))
  await expect(page.getByRole("button", { name: "계속", exact: true })).toBeVisible()
  const frozen = await page.getByLabel("경기 진행 시간").textContent()
  await page.clock.runFor(3000)
  await expect(page.getByLabel("경기 진행 시간")).toHaveText(frozen!)
  await page.getByRole("button", { name: "계속", exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "계속", exact: true })).toBeVisible()
  expect(await noSideScroll(page)).toBe(true)
})

/** Replays a planned run with real keys, picking "일정한 박자" at each checkpoint (the pick starts the next stage).
 * `afterResume` may run the clock; it returns the milliseconds it used so the replay stays on plan. */
async function replay(page: Page, plan: Step[], afterResume?: (index: number) => Promise<number>) {
  let now = 0, checkpoints = 0
  for (const step of plan) {
    if (step.at > now) { await page.clock.runFor(Math.round(step.at - now)); now = step.at }
    if (step.key === "run-down") await page.keyboard.down("ArrowRight")
    else if (step.key === "run-up") await page.keyboard.up("ArrowRight")
    else if (step.key === "jump") await page.keyboard.press("Space")
    else {
      await page.clock.runFor(2500)
      await expect(page.getByRole("heading", { name: "어떤 능력을 키울까요?" })).toBeVisible()
      await page.getByRole("button", { name: /일정한 박자/ }).click()
      now += (await afterResume?.(checkpoints)) ?? 0
      checkpoints += 1
    }
  }
  await page.clock.runFor(1200)
  await page.keyboard.up("ArrowRight")
}
test("a later-stage failure offers 'retry this stage' with the same build, capped at one star", async ({ page }, info) => {
  await openGame(page)
  const plan = planRun()
  await page.getByRole("button", { name: "시작", exact: true }).click()
  // Play through the first checkpoint, then stop running so the runner falls in stage 2.
  let now = 0
  for (const step of plan) {
    if (step.at > now) { await page.clock.runFor(Math.round(step.at - now)); now = step.at }
    if (step.key === "upgrade") { await page.clock.runFor(2500); await page.getByRole("button", { name: /스프링 밑창/ }).click(); break }
    if (step.key === "run-down") await page.keyboard.down("ArrowRight")
    else if (step.key === "run-up") await page.keyboard.up("ArrowRight")
    else if (step.key === "jump") await page.keyboard.press("Space")
  }
  await page.keyboard.up("ArrowRight")
  await page.clock.runFor(12000)
  await expect(page.getByRole("heading", { name: "진흙에서 뒤로 떨어졌어요" })).toBeVisible()
  const retry = page.getByRole("button", { name: /2구간부터 다시/ })
  await expect(retry).toBeVisible()
  await expect(page.getByRole("button", { name: "다시 도전", exact: true })).toHaveCount(0)
  expect(await noSideScroll(page)).toBe(true)
  await page.screenshot({ path: info.outputPath("retry-offer.png"), fullPage: true })
  await retry.click()
  await expect(page.getByRole("list", { name: "코스 2/3 · 진흙" })).toBeVisible()
  await expect(page.getByLabel("경기 진행 시간")).toHaveText("30 / 90초")
  // Same build: the spring upgrade keeps the jump cheap.
  await expect(page.getByLabel("점프 에너지", { exact: true })).toContainText("4")
})

test("medals: a fixed medal per run whatever the result, spent only on a cosmetic trail in the shop", async ({ page }, info) => {
  await page.goto("/?app=1")
  // Seed 9 medals earned on earlier days, plus progress, then fail one run.
  await page.evaluate(() => localStorage.setItem("trainoracle.minigame.progress.v1", JSON.stringify({
    version: "MINIGAME_PROGRESS_V1", character: "tori", settingsUpdatedAt: "2026-10-08T00:00:00.000Z", cities: {},
    settings: { sound: false, vibration: false, effects: "low", view: "auto", motion: "system", controls: "normal", runSide: "left", jumpGuide: true },
    medals: { days: { "2000-01-01": [5, 0], "2000-01-02": [4, 0] }, months: {}, owned: [], trail: null },
  })))
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  // Hold run briefly so the run lasts past the 8-second minimum, then let go and fall.
  await page.clock.runFor(3100)
  await page.keyboard.down("ArrowRight"); await page.clock.runFor(3500); await page.keyboard.up("ArrowRight")
  await page.clock.runFor(12000)
  await expect(page.getByRole("heading", { name: "트랙에서 뒤로 떨어졌어요" })).toBeVisible()
  // A failed run still pays exactly one medal.
  await expect(page.getByText("메달 +1")).toBeVisible()
  await page.screenshot({ path: info.outputPath("medal-result.png"), fullPage: true })
  await page.getByRole("button", { name: "지도", exact: true }).click()
  await page.getByRole("button", { name: /메달 10개/ }).click()
  const dialog = page.getByRole("dialog", { name: "게임 메뉴" })
  await expect(dialog.getByRole("tab", { name: "상점" })).toHaveAttribute("aria-selected", "true")
  await expect(dialog.getByRole("button", { name: /무지개 꼬리 메달 35개로 열기/ })).toBeDisabled()
  await dialog.getByRole("button", { name: /별가루 메달 10개로 열기/ }).click()
  await expect(dialog.getByRole("button", { name: "장착 중" })).toBeVisible()
  await expect(dialog.getByText("포인트(P)·현금으로 바꿀 수 없어요", { exact: false })).toBeVisible()
  await page.screenshot({ path: info.outputPath("medal-shop.png") })
  const saved = await savedProgress(page)
  expect(saved.medals.owned).toEqual(["stardust"])
  expect(saved.medals.trail).toBe("stardust")
})

const savedProgress = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.minigame.progress.v1") ?? "null"))

test("tours Seoul in 2.5D, saves stars on this device, unlocks the next city and keeps it after reload", async ({ page }, info) => {
  test.setTimeout(180_000) // Real input replay of the longer 90-second course.
  const external: string[] = []
  const scenery = new Set<string>()
  page.on("response", response => { if (response.ok() && /\/game\/seoul-v1\/.*\.webp$/u.test(response.url())) scenery.add(response.url()) })
  page.on("request", request => { const url = new URL(request.url()); if (url.hostname !== "127.0.0.1" && url.protocol !== "data:") external.push(url.href) })
  await page.goto("/?app=1")
  await page.evaluate(() => localStorage.removeItem("trainoracle.minigame.progress.v1"))
  await openGame(page, "seoul")
  await expect.poll(() => scenery.size).toBe(6)
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-view", "city")
  await expect(page.getByRole("heading", { name: "서울 · 한강을 따라 남산타워까지" })).toBeVisible()
  await expect(page.locator(".treadmill-game__intro-stages")).toHaveText(/한강 러닝트랙.*비 오는 자전거길.*남산 야간 공사길/u)
  expect(await noSideScroll(page)).toBe(true)
  await page.screenshot({ path: info.outputPath("seoul-ready.png"), fullPage: true })
  await page.getByRole("button", { name: "시작", exact: true }).click()
  // Simulated time is paused between steps, so mid-run screenshots do not change the run.
  await replay(page, planRun(tourStages(tourCity("seoul")!)), async index => {
    await expect(page.getByRole("list", { name: `코스 ${index + 2}/3 · ${index === 0 ? "비 오는 자전거길" : "남산 야간 공사길"}` })).toBeVisible()
    // Inside the 1s resume countdown the belt is still, so drawing frames here does not move the run.
    await page.clock.runFor(600)
    await page.screenshot({ path: info.outputPath(index === 0 ? "seoul-rain.png" : "seoul-night.png"), fullPage: true })
    return 600
  })
  await expect(page.getByRole("heading", { name: "서울 완주!" })).toBeVisible()
  await expect(page.getByText("대전 열림")).toBeVisible()
  await expect(page.getByText("새 캐릭터 단단")).toBeVisible()
  await page.screenshot({ path: info.outputPath("seoul-clear.png"), fullPage: true })
  const saved = await savedProgress(page)
  expect(saved.cities.seoul.stars).toBeGreaterThan(0)
  expect(Object.keys(saved).sort()).toEqual(["character", "cities", "medals", "settings", "settingsUpdatedAt", "version"])
  // One medal for the run, whatever the score.
  expect(Object.values(saved.medals.days)).toEqual([[1, 0]])
  await expect(page.getByRole("button", { name: "다음 도시 · 대전" })).toBeVisible()
  await page.getByRole("button", { name: "지도", exact: true }).click()
  await expect(page.getByRole("button", { name: /^대전 · / })).toBeEnabled()
  await expect(page.getByRole("button", { name: /^대구 \(잠김\)/ })).toBeDisabled()
  await page.reload()
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
  await expect(page.getByRole("button", { name: /^대전 · / })).toBeEnabled()
  await expect(page.getByText("이 기기에 저장")).toBeVisible()
  await expect(page.locator(".treadmill-game__city-preview canvas")).toHaveAttribute("data-art", "settled")
  await page.screenshot({ path: info.outputPath("tour-map.png"), fullPage: true })
  expect(external).toEqual([])
})

test("missing miniature images keep Seoul playable with vector fallbacks", async ({ page }, info) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await openGame(page, "seoul", false, true)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(3200)
  await page.keyboard.down("ArrowRight")
  await page.clock.runFor(800)
  await page.keyboard.up("ArrowRight")
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-mode", "running")
  expect(await noSideScroll(page)).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath("seoul-missing-art.png"), fullPage: true })
})

test("menu: settings change the game and persist, help explains the rules, open source lists licenses", async ({ page }, info) => {
  await page.goto("/?app=1")
  await page.evaluate(() => localStorage.removeItem("trainoracle.minigame.progress.v1"))
  await openGame(page, "seoul")
  await page.getByRole("button", { name: /게임 메뉴/ }).click()
  const dialog = page.getByRole("dialog", { name: "게임 메뉴" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("radio", { name: /단단/ })).toBeDisabled()
  await dialog.getByRole("radio", { name: /하나/ }).click()
  await expect(dialog.getByRole("radio", { name: /하나/ })).toHaveAttribute("aria-checked", "true")
  await dialog.getByRole("switch", { name: /점프 타이밍/ }).uncheck()
  await dialog.getByText("클래식 옆모습").click()
  await dialog.getByRole("switch", { name: /효과음/ }).uncheck()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath("menu-settings.png") })
  await dialog.getByRole("tab", { name: "도움말" }).click()
  await expect(dialog.getByRole("heading", { name: "별과 해금" })).toBeVisible()
  await expect(dialog.getByText(/포인트\(P\)를 읽거나 바꾸지 않아요/)).toBeVisible()
  await page.screenshot({ path: info.outputPath("menu-help.png") })
  await dialog.getByRole("tab", { name: "오픈소스" }).click()
  for (const name of ["shaders", "TypeGPU", "tinyest", "Lucide", "Pretendard"]) await expect(dialog.getByText(name, { exact: false }).first()).toBeVisible()
  const hrefs = await dialog.getByRole("link", { name: "라이선스 전문 보기" }).evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href))
  for (const href of hrefs) expect((await page.request.get(href)).status(), href).toBe(200)
  await page.screenshot({ path: info.outputPath("menu-licenses.png") })
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(page.locator(".treadmill-game__controls")).toHaveCount(0)
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-view", "flat")
  const saved = await savedProgress(page)
  expect(saved.character).toBe("hana")
  expect(saved.settings).toMatchObject({ jumpGuide: false, view: "flat", sound: false })
})

test("navigation saves a paused run, restores it after reload and confirms a fresh start", async ({ page }, info) => {
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(3100)
  await page.keyboard.down("ArrowRight"); await page.clock.runFor(2200); await page.keyboard.up("ArrowRight")
  await page.getByRole("button", { name: "일시정지", exact: true }).click()
  const beforeEnergy = await energy(page)
  const beforeTime = await page.getByLabel("경기 진행 시간").textContent()
  await page.getByRole("button", { name: "저장하고 지도로 나가기" }).click()
  const card = page.getByRole("region", { name: "중간 저장한 판" })
  await expect(card).toBeVisible()
  await expect(card).toContainText("러닝머신 연습")
  await page.screenshot({ path: info.outputPath("saved-run-map.png"), fullPage: true })
  await page.reload()
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
  await page.getByRole("button", { name: "저장한 판 이어하기" }).click()
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-mode", "paused")
  expect(await energy(page)).toBe(beforeEnergy)
  await expect(page.getByLabel("경기 진행 시간")).toHaveText(beforeTime!)
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.minigame.saved-run.v1"))).toBeNull()
  await page.getByRole("button", { name: "처음부터", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "새 판을 시작할까요?" })).toBeVisible()
  await page.getByRole("button", { name: "돌아가기", exact: true }).click()
  await expect(page.getByLabel("경기 진행 시간")).toHaveText(beforeTime!)
  await page.getByRole("button", { name: "처음부터", exact: true }).click()
  await page.getByRole("button", { name: "처음부터 시작하기" }).click()
  await expect(page.getByLabel("게임 에너지", { exact: true })).toHaveText("에너지 100")
  await page.getByRole("button", { name: "게임 메뉴 (설정·도움말·오픈소스)" }).click()
  await page.getByRole("button", { name: "게임 나가기", exact: true }).click()
  await page.getByRole("button", { name: "저장 없이 나가기" }).click()
  await expect(page.getByRole("heading", { name: "더보기", exact: true })).toBeVisible()
})

test("navigation native Back confirms exit, handles save failure and returns to play", async ({ page }, info) => {
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(3100)
  await page.goBack()
  const dialog = page.getByRole("dialog", { name: "지도로 나갈까요?" })
  await expect(dialog).toBeVisible()
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-mode", "paused")
  await page.screenshot({ path: info.outputPath("leave-dialog.png"), fullPage: true })
  expect(await noSideScroll(page)).toBe(true)
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-mode", "running")
  await page.getByRole("button", { name: "투어 지도로", exact: true }).click()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    ;(window as unknown as { restoreSave: () => void }).restoreSave = () => { Storage.prototype.setItem = original }
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("trainoracle.minigame.saved-run")) throw new DOMException("synthetic quota", "QuotaExceededError")
      original.call(this, key, value)
    }
  })
  await page.getByRole("button", { name: "저장하고 나가기", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("저장하지 못했어요")
  await expect(dialog).toBeVisible()
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-screen", "play")
  await page.evaluate(() => (window as unknown as { restoreSave: () => void }).restoreSave())
  await page.getByRole("button", { name: "저장하고 나가기", exact: true }).click()
  await expect(page.getByRole("region", { name: "중간 저장한 판" })).toBeVisible()
  await page.getByRole("button", { name: "러닝머신 연습" }).click()
  await expect(page.getByRole("dialog", { name: "저장한 판 대신 새로 시작할까요?" })).toBeVisible()
  await page.getByRole("button", { name: "돌아가기", exact: true }).click()
  await page.getByRole("button", { name: "저장한 판 지우기" }).click()
  await page.getByRole("button", { name: "지우고 진행하기" }).click()
  await expect(page.getByRole("region", { name: "중간 저장한 판" })).toHaveCount(0)
})

test("navigation keeps the chosen upgrade when saving and resuming a later stage", async ({ page }) => {
  test.setTimeout(120_000)
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  let now = 0
  for (const step of planRun()) {
    if (step.at > now) { await page.clock.runFor(Math.round(step.at - now)); now = step.at }
    if (step.key === "upgrade") break
    if (step.key === "run-down") await page.keyboard.down("ArrowRight")
    else if (step.key === "run-up") await page.keyboard.up("ArrowRight")
    else await page.keyboard.press("Space")
  }
  await page.keyboard.up("ArrowRight")
  await page.clock.runFor(2500)
  await page.getByRole("button", { name: /스프링 밑창/ }).click()
  await page.getByRole("button", { name: "일시정지", exact: true }).click()
  await page.getByRole("button", { name: "저장하고 지도로 나가기" }).click()
  await expect(page.getByRole("region", { name: "중간 저장한 판" })).toContainText("스프링 밑창")
  await page.reload()
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
  await page.getByRole("button", { name: "저장한 판 이어하기" }).click()
  await expect(page.getByRole("list", { name: "코스 2/3 · 진흙" })).toBeVisible()
  await expect(page.getByLabel("점프 에너지", { exact: true })).toContainText("4")
  await page.getByRole("button", { name: "계속", exact: true }).click()
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-mode", "running")
})

test("navigation tour reset clears the saved run and returns to the map", async ({ page }) => {
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.getByRole("button", { name: "일시정지", exact: true }).click()
  await page.getByRole("button", { name: "저장하고 지도로 나가기" }).click()
  await expect(page.getByRole("region", { name: "중간 저장한 판" })).toBeVisible()
  await page.getByRole("button", { name: "게임 메뉴 (설정·도움말·오픈소스)" }).click()
  await page.getByRole("button", { name: "투어 처음부터 다시 하기" }).click()
  await expect(page.getByRole("alertdialog")).toContainText("중간 저장한 판")
  await page.getByRole("button", { name: "지우기", exact: true }).click()
  await expect(page.getByText("투어 기록을 지웠어요.", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "메뉴 닫기" }).click()
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-screen", "map")
  await expect(page.getByRole("region", { name: "중간 저장한 판" })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.minigame.saved-run.v1"))).toBeNull()
})
