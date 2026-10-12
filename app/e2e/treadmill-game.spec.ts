import { test, expect, type Page } from "@playwright/test"
import { advanceTreadmill, nearestHazard, newTreadmillRun, treadmillCommand, TREADMILL_STAGES } from "../src/domain/minigame/treadmill"
import type { TreadmillStage, TreadmillState } from "../src/domain/minigame/treadmill"
import { tourCity, tourStages } from "../src/domain/minigame/tour"

async function openGame(page: Page, course: "practice" | "seoul" = "practice") {
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
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
  for (let frame = 0; frame < 4000 && (state.mode === "running" || state.mode === "upgrade"); frame++) {
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
  await expect(page.getByRole("heading", { name: "30초 동안 바닥 위에서 버티세요" })).toBeVisible()
  await expect(page.getByRole("navigation")).toHaveCount(0)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(1000)
  await expect(page.getByRole("button", { name: /점프/ })).toBeDisabled()
  await page.clock.runFor(10000)
  await expect(page.getByRole("heading", { name: "트랙에서 뒤로 떨어졌어요" })).toBeVisible()
  await page.getByText("이번 판 기록").click()
  await expect(page.getByText(/^버틴 시간/)).toBeVisible()
  await expect(page.getByText(/손을 놓으세요|다시 달리세요|미리 쉬어 두세요/)).toBeVisible()
  // Stage 1 failure: the one primary action is a full retry.
  await page.getByRole("button", { name: "다시 도전", exact: true }).click()
  await page.clock.runFor(3100)
  const run = page.getByRole("button", { name: /달리기 꾹/ })
  await run.hover(); await page.mouse.down(); await page.clock.runFor(1500)
  await expect(run).toHaveAttribute("aria-pressed", "true")
  const before = await energy(page)
  await page.mouse.up(); await page.clock.runFor(600)
  await expect(run).toHaveAttribute("aria-pressed", "false")
  expect(await energy(page)).toBeGreaterThan(before)
  await page.getByRole("button", { name: "일시정지", exact: true }).click()
  await expect(page.getByRole("button", { name: "계속", exact: true })).toBeVisible()
  const frozen = await page.getByLabel("경기 진행 시간").textContent()
  await page.clock.runFor(2000)
  await expect(page.getByLabel("경기 진행 시간")).toHaveText(frozen!)
  await page.getByRole("button", { name: "투어 지도로" }).click()
  await page.getByRole("button", { name: "더보기로 돌아가기" }).click()
  await expect(page.getByRole("heading", { name: "더보기", exact: true })).toBeVisible()
  await page.clock.runFor(10000)
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
  await page.getByRole("button", { name: "러닝머신 연습" }).click()
  await expect(page.getByLabel("게임 에너지", { exact: true })).toHaveText("에너지 100")
  await expect(page.getByRole("button", { name: "시작", exact: true })).toBeVisible()
})

test("clears three stages with real keys, shows trade-offs and resets the build", async ({ page }, info) => {
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
      await expect(page.getByRole("heading", { name: "강화 하나 고르면 바로 출발" })).toBeVisible()
      await expect(page.getByText("− 대시 충전 +1초 · 회복 −10%")).toBeVisible()
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
      await expect(page.getByRole("heading", { name: "강화 하나 고르면 바로 출발" })).toHaveCount(0)
      await expect(page.getByRole("list", { name: `코스 ${checkpoints + 2}/3 · ${checkpoints === 0 ? "진흙" : "가시밭"}` })).toBeVisible()
      await expect(page.getByRole("button", { name: "계속", exact: true })).toHaveCount(0)
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
  await page.getByRole("button", { name: /대시/ }).click()
  await expect(page.getByLabel("게임 에너지", { exact: true })).not.toHaveText("에너지 100")
  await expect(page.getByRole("button", { name: /대시/ })).toBeDisabled()
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
      await expect(page.getByRole("heading", { name: "강화 하나 고르면 바로 출발" })).toBeVisible()
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
    if (step.key === "upgrade") { await page.getByRole("button", { name: /스프링 밑창/ }).click(); break }
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
  await expect(page.getByLabel("경기 진행 시간")).toHaveText("10 / 30초")
  // Same build: the spring upgrade keeps the jump cheap.
  await expect(page.getByRole("button", { name: /점프/ })).toContainText("4")
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
  const external: string[] = []
  page.on("request", request => { const url = new URL(request.url()); if (url.hostname !== "127.0.0.1" && url.protocol !== "data:") external.push(url.href) })
  await page.goto("/?app=1")
  await page.evaluate(() => localStorage.removeItem("trainoracle.minigame.progress.v1"))
  await openGame(page, "seoul")
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
  await page.screenshot({ path: info.outputPath("tour-map.png"), fullPage: true })
  expect(external).toEqual([])
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
  await dialog.getByText("크게", { exact: true }).click()
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
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-controls", "large")
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-view", "flat")
  const saved = await savedProgress(page)
  expect(saved.character).toBe("hana")
  expect(saved.settings).toMatchObject({ controls: "large", view: "flat", sound: false })
})
