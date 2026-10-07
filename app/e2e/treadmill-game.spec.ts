import { test, expect, type Page } from "@playwright/test"
import { advanceTreadmill, nearestHazard, newTreadmillRun, treadmillCommand } from "../src/domain/minigame/treadmill"
import type { TreadmillState } from "../src/domain/minigame/treadmill"

async function openGame(page: Page) {
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    return url.hostname === "127.0.0.1" || url.protocol === "data:" ? route.continue() : route.abort()
  })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
  await expect(page.getByRole("heading", { name: "멈추면 밀려나는 트랙" })).toBeVisible()
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
function planRun(): Step[] {
  const steps: Step[] = []
  let state: TreadmillState = treadmillCommand(newTreadmillRun(), { type: "start" })
  let ms = 0
  for (let frame = 0; frame < 4000 && (state.mode === "running" || state.mode === "upgrade"); frame++) {
    if (state.mode === "upgrade") {
      steps.push({ at: ms, key: "upgrade" })
      state = treadmillCommand(treadmillCommand(state, { type: "upgrade", upgrade: "economy" }), { type: "resume" })
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
  await openGame(page)
  await expect(page.getByRole("heading", { name: "30초 동안 바닥 위에서 버티세요" })).toBeVisible()
  await expect(page.getByRole("navigation")).toHaveCount(0)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(8000)
  await expect(page.getByRole("heading", { name: "트랙에서 뒤로 떨어졌어요" })).toBeVisible()
  await expect(page.getByText(/^버틴 시간/)).toBeVisible()
  await expect(page.getByText(/손을 놓으세요|다시 달리세요|미리 쉬어 두세요/)).toBeVisible()
  await page.getByRole("button", { name: "다시 시작", exact: true }).click()
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
  await page.getByRole("button", { name: "더보기로 돌아가기" }).click()
  await expect(page.getByRole("heading", { name: "더보기", exact: true })).toBeVisible()
  await page.clock.runFor(10000)
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
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
      await expect(page.getByRole("heading", { name: "안전 발판 · 강화 하나 선택" })).toBeVisible()
      await expect(page.getByText("− 대시 충전 +1초 · 회복 −10%")).toBeVisible()
      const time = await page.getByLabel("경기 진행 시간").textContent()
      await page.clock.runFor(2000)
      await expect(page.getByLabel("경기 진행 시간")).toHaveText(time!)
      if (checkpoints === 0) {
        await expect(page.getByText("다음 구간에 맞음")).toBeVisible()
        expect(await noSideScroll(page)).toBe(true)
        await page.screenshot({ path: info.outputPath("checkpoint.png"), fullPage: true })
      }
      await page.getByRole("button", { name: /일정한 박자/ }).click()
      await expect(page.getByText(checkpoints === 0 ? "2구간 · 진흙" : "3구간 · 가시밭")).toBeVisible()
      await page.getByRole("button", { name: "계속", exact: true }).click()
      checkpoints += 1
    }
  }
  // The planned run ends exactly on the finish; leave a little time for frame-boundary drift.
  await page.clock.runFor(1200)
  await page.keyboard.up("ArrowRight")
  await expect(page.getByRole("heading", { name: "세 구간 완주!" })).toBeVisible()
  await expect(page.getByText("이번 판: 일정한 박자 · 일정한 박자")).toBeVisible()
  await page.screenshot({ path: info.outputPath("clear.png"), fullPage: true })
  await page.getByRole("button", { name: "다시 시작", exact: true }).click()
  await expect(page.getByRole("list", { name: "코스 1/3 · 트랙" })).toBeVisible()
  await expect(page.getByText(/^이번 판:/)).toHaveCount(0)
  await expect(page.getByLabel("게임 에너지", { exact: true })).toHaveText("에너지 100")
})

test("focus loss pauses, Esc pauses, and reduced motion preserves movement and controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
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
