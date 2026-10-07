/**
 * Fictional game balance only. No training, reward, account or health inputs.
 * Horizontal values are fractions of the belt width (0 = rear edge, 1 = front);
 * vertical values are logical pixels of a 360px-wide field so the drawing and
 * the hit boxes are the same on every screen.
 */
export const TREADMILL_RULES = {
  version: 2,
  stageSeconds: 10,
  maxEnergy: 100,
  startPosition: 0.5,
  fallEdge: 0.06,
  frontEdge: 0.88,
  runDrain: 9,
  recovery: 12,
  jumpCost: 8,
  dashCost: 20,
  dashSeconds: 0.45,
  dashSpeed: 0.42,
  dashCooldown: 2.5,
  gravity: 1150,
  jumpVelocity: 470,
  hazardSpeed: 0.28,
  runnerHalfWidth: 0.018,
  barrierKnockback: 0.12,
  barrierEnergy: 12,
  invulnerableSeconds: 0.9,
  checkpointRefill: 30,
  telegraphSeconds: 1.4,
  /** Gap (hazard centre minus runner) where a jump clears. Drawn as a guide only. */
  jumpWindow: [0.07, 0.12],
  warnRear: 0.2,
} as const

export type TreadmillHazardKind = "barrier" | "spike"

export const TREADMILL_HAZARDS: Record<TreadmillHazardKind, { halfWidth: number; height: number }> = {
  barrier: { halfWidth: 0.022, height: 26 },
  spike: { halfWidth: 0.03, height: 16 },
}

/** Fixed course. `at` is the stage second at which a hazard enters from the front edge. */
export const TREADMILL_STAGES = [
  { id: "track", name: "트랙", belt: 0.07, movement: 0.115, hint: "기본 속도. 달리고 쉬는 박자를 익히는 구간",
    course: [{ at: 1.6, kind: "barrier" }, { at: 4.6, kind: "barrier" }, { at: 7.2, kind: "barrier" }] },
  { id: "mud", name: "진흙", belt: 0.084, movement: 0.092, hint: "달려도 덜 나아가요. 앞쪽 공간을 미리 벌어 두세요",
    course: [{ at: 1.2, kind: "barrier" }, { at: 3.6, kind: "barrier" }, { at: 5.6, kind: "barrier" }, { at: 7.6, kind: "barrier" }] },
  { id: "spikes", name: "가시밭", belt: 0.074, movement: 0.115, hint: "가시는 한 번만 닿아도 끝. 점프할 에너지를 남기세요",
    course: [{ at: 1.0, kind: "spike" }, { at: 2.9, kind: "spike" }, { at: 4.6, kind: "barrier" }, { at: 5.9, kind: "spike" }, { at: 7.6, kind: "spike" }] },
] as const satisfies readonly {
  id: string; name: string; belt: number; movement: number; hint: string
  course: readonly { at: number; kind: TreadmillHazardKind }[]
}[]

export const TREADMILL_UPGRADES = [
  { id: "grip", name: "접지 밑창", benefit: "진흙 전진 +50% · 부딪혀도 덜 밀림", cost: "점프 에너지 +3", fits: "mud" },
  { id: "spring", name: "스프링 밑창", benefit: "점프 에너지 −4", cost: "달리기 전진 −12%", fits: "spikes" },
  { id: "economy", name: "일정한 박자", benefit: "달리기 소모 −20%", cost: "대시 충전 +1초 · 회복 −10%", fits: null },
] as const

export type TreadmillUpgrade = typeof TREADMILL_UPGRADES[number]["id"]
export type TreadmillMode = "ready" | "running" | "paused" | "upgrade" | "over" | "clear"
export type TreadmillFailure = "fall" | "spike"
export type TreadmillCommand =
  | { type: "start" }
  | { type: "run"; held: boolean }
  | { type: "jump" }
  | { type: "dash" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "upgrade"; upgrade: TreadmillUpgrade }

export type TreadmillHazard = { id: number; kind: TreadmillHazardKind; x: number; hit: boolean; passed: boolean }
export type TreadmillStats = { hits: number; cleared: number; jumps: number; dashes: number; restSeconds: number; lowestEnergy: number }

export type TreadmillState = {
  mode: TreadmillMode
  stage: number
  seconds: number
  x: number
  y: number
  velocityY: number
  energy: number
  running: boolean
  /** True while the run input is held but there is no energy left to move. */
  exhausted: boolean
  dashLeft: number
  cooldown: number
  invulnerable: number
  /** Seconds since the last barrier hit, for a short visual reaction. */
  hitFlash: number
  /** Seconds since the last landing, for a short visual reaction. */
  landed: number
  hazards: TreadmillHazard[]
  spawned: number
  upgrades: TreadmillUpgrade[]
  mudBonus: number
  jumpCost: number
  jumpVelocity: number
  dashFactor: number
  knockbackFactor: number
  strideFactor: number
  runDrainFactor: number
  recoveryFactor: number
  cooldownSeconds: number
  failure: TreadmillFailure | null
  stats: TreadmillStats
  message: string
}

const freshStats = (): TreadmillStats => ({ hits: 0, cleared: 0, jumps: 0, dashes: 0, restSeconds: 0, lowestEnergy: TREADMILL_RULES.maxEnergy })

export function newTreadmillRun(): TreadmillState {
  const rules = TREADMILL_RULES
  return {
    mode: "ready", stage: 0, seconds: 0, x: rules.startPosition, y: 0, velocityY: 0,
    energy: rules.maxEnergy, running: false, exhausted: false, dashLeft: 0, cooldown: 0, invulnerable: 0,
    hitFlash: 9, landed: 9, hazards: [], spawned: 0, upgrades: [], mudBonus: 0, jumpCost: rules.jumpCost,
    jumpVelocity: rules.jumpVelocity, dashFactor: 1, knockbackFactor: 1, strideFactor: 1, runDrainFactor: 1, recoveryFactor: 1,
    cooldownSeconds: rules.dashCooldown, failure: null, stats: freshStats(),
    message: "달리면 앞으로, 놓으면 회복하며 뒤로 밀려요.",
  }
}

/** Total course seconds already completed, for a single progress value. */
export function treadmillElapsed(state: TreadmillState): number {
  return state.stage * TREADMILL_RULES.stageSeconds + state.seconds
}

export function treadmillCourseSeconds(): number {
  return TREADMILL_STAGES.length * TREADMILL_RULES.stageSeconds
}

export function applyUpgrade(state: TreadmillState, upgrade: TreadmillUpgrade): TreadmillState {
  const next = { ...state, upgrades: [...state.upgrades, upgrade] }
  if (upgrade === "grip") { next.mudBonus += 0.5; next.knockbackFactor *= 0.5; next.jumpCost += 3 }
  if (upgrade === "spring") { next.jumpCost = Math.max(2, next.jumpCost - 4); next.strideFactor *= 0.88 }
  if (upgrade === "economy") { next.runDrainFactor *= 0.8; next.cooldownSeconds += 1; next.recoveryFactor *= 0.9 }
  return next
}

export function treadmillCommand(state: TreadmillState, command: TreadmillCommand): TreadmillState {
  if (command.type === "start") {
    return { ...newTreadmillRun(), mode: "running", message: "달리면 앞으로, 놓으면 회복하며 뒤로 밀려요." }
  }
  if (command.type === "pause" && state.mode === "running") {
    return { ...state, mode: "paused", running: false, exhausted: false, message: "일시정지" }
  }
  if (command.type === "resume" && state.mode === "paused") {
    return { ...state, mode: "running", running: false, exhausted: false, message: "출발!" }
  }
  if (command.type === "upgrade" && state.mode === "upgrade") {
    const next = applyUpgrade(state, command.upgrade)
    return {
      ...next, stage: state.stage + 1, seconds: 0, x: TREADMILL_RULES.startPosition, y: 0, velocityY: 0,
      energy: Math.min(TREADMILL_RULES.maxEnergy, state.energy + TREADMILL_RULES.checkpointRefill),
      hazards: [], spawned: 0, dashLeft: 0, cooldown: 0, invulnerable: 0, hitFlash: 9, landed: 9,
      running: false, exhausted: false, mode: "paused", message: "준비되면 출발하세요.",
    }
  }
  if (state.mode !== "running") return state
  switch (command.type) {
    case "run": return state.running === command.held ? state : { ...state, running: command.held, exhausted: command.held && state.energy <= 0 }
    case "jump": return state.y === 0 && state.velocityY === 0 && state.energy >= state.jumpCost
      ? { ...state, energy: state.energy - state.jumpCost, y: 0.1, velocityY: state.jumpVelocity,
        stats: { ...state.stats, jumps: state.stats.jumps + 1, lowestEnergy: Math.min(state.stats.lowestEnergy, state.energy - state.jumpCost) } }
      : state
    case "dash": return state.cooldown === 0 && state.energy >= TREADMILL_RULES.dashCost
      ? { ...state, energy: state.energy - TREADMILL_RULES.dashCost, dashLeft: TREADMILL_RULES.dashSeconds, cooldown: state.cooldownSeconds,
        stats: { ...state.stats, dashes: state.stats.dashes + 1, lowestEnergy: Math.min(state.stats.lowestEnergy, state.energy - TREADMILL_RULES.dashCost) } }
      : state
    default: return state
  }
}

function overlaps(runnerX: number, hazard: TreadmillHazard): boolean {
  return Math.abs(hazard.x - runnerX) < TREADMILL_HAZARDS[hazard.kind].halfWidth + TREADMILL_RULES.runnerHalfWidth
}

function step(state: TreadmillState, dt: number): TreadmillState {
  const rules = TREADMILL_RULES
  const stage = TREADMILL_STAGES[state.stage]!
  const next: TreadmillState = { ...state, stats: { ...state.stats }, hazards: state.hazards.map(hazard => ({ ...hazard })) }
  next.seconds += dt
  next.cooldown = Math.max(0, state.cooldown - dt)
  next.invulnerable = Math.max(0, state.invulnerable - dt)
  next.hitFlash = state.hitFlash + dt
  next.landed = state.landed + dt
  const drain = rules.runDrain * state.runDrainFactor
  const runningSeconds = state.running ? Math.min(dt, state.energy / drain) : 0
  const dashSeconds = Math.min(dt, state.dashLeft)
  next.dashLeft = Math.max(0, state.dashLeft - dt)
  // Holding an exhausted run button does not silently regenerate between frames.
  next.energy = state.running
    ? Math.max(0, state.energy - runningSeconds * drain)
    : Math.min(rules.maxEnergy, state.energy + dt * rules.recovery * state.recoveryFactor)
  next.exhausted = state.running && next.energy <= 0
  if (!state.running) next.stats.restSeconds += dt
  next.stats.lowestEnergy = Math.min(next.stats.lowestEnergy, next.energy)
  const movement = stage.movement * state.strideFactor * (stage.id === "mud" ? 1 + state.mudBonus : 1)
  next.x = Math.min(rules.frontEdge, state.x - stage.belt * dt + runningSeconds * movement
    + dashSeconds * rules.dashSpeed * state.dashFactor)
  if (state.y > 0 || state.velocityY > 0) {
    next.velocityY -= rules.gravity * dt
    next.y = Math.max(0, state.y + next.velocityY * dt)
    if (next.y === 0) { next.velocityY = 0; next.landed = 0 }
  }
  const course = stage.course
  while (next.spawned < course.length && next.seconds >= course[next.spawned]!.at) {
    next.hazards.push({ id: state.stage * 100 + next.spawned, kind: course[next.spawned]!.kind, x: 1.06, hit: false, passed: false })
    next.spawned += 1
  }
  for (const hazard of next.hazards) {
    const before = hazard.x - state.x
    hazard.x -= rules.hazardSpeed * dt
    const shape = TREADMILL_HAZARDS[hazard.kind]
    const reach = shape.halfWidth + rules.runnerHalfWidth
    const crossed = before > reach && hazard.x - next.x < -reach
    const low = Math.min(state.y, next.y) < shape.height
    if (!hazard.hit && !hazard.passed && (overlaps(next.x, hazard) || crossed) && low && next.invulnerable === 0) {
      hazard.hit = true
      next.stats.hits += 1
      if (hazard.kind === "spike") {
        return { ...next, mode: "over", running: false, exhausted: false, failure: "spike", message: "가시에 닿았어요." }
      }
      next.x -= rules.barrierKnockback * state.knockbackFactor
      next.energy = Math.max(0, next.energy - rules.barrierEnergy)
      next.invulnerable = rules.invulnerableSeconds
      next.hitFlash = 0
      next.message = "장애물에 부딪혀 밀렸어요!"
    } else if (!hazard.hit && !hazard.passed && hazard.x + shape.halfWidth < next.x - rules.runnerHalfWidth) {
      hazard.passed = true
      next.stats.cleared += 1
    }
  }
  next.hazards = next.hazards.filter(hazard => hazard.x > -0.08)
  if (next.x < rules.fallEdge) {
    return { ...next, mode: "over", running: false, exhausted: false, failure: "fall", message: "뒤쪽 끝에서 떨어졌어요." }
  }
  if (next.seconds >= rules.stageSeconds) {
    const clear = next.stage === TREADMILL_STAGES.length - 1
    return { ...next, seconds: rules.stageSeconds, mode: clear ? "clear" : "upgrade", running: false, exhausted: false,
      message: clear ? "세 구간 완주!" : "안전 발판 도착! 바닥이 멈췄어요." }
  }
  return next
}

/** Substeps keep collisions stable across display refresh rates; long stalls pause in the UI. */
export function advanceTreadmill(state: TreadmillState, seconds: number): TreadmillState {
  if (state.mode !== "running" || !Number.isFinite(seconds) || seconds <= 0) return state
  let next = state
  let remaining = Math.min(seconds, 0.1)
  while (remaining > 0.000001 && next.mode === "running") {
    const dt = Math.min(remaining, 1 / 120)
    next = step(next, dt)
    remaining -= dt
  }
  return next
}

/** Hazards that will enter within the telegraph window, so the screen can announce them early. */
export function upcomingHazards(state: TreadmillState): { kind: TreadmillHazardKind; inSeconds: number }[] {
  const course = TREADMILL_STAGES[state.stage]!.course
  return course.slice(state.spawned)
    .map(item => ({ kind: item.kind, inSeconds: item.at - state.seconds }))
    .filter(item => item.inSeconds <= TREADMILL_RULES.telegraphSeconds)
}

export function nearestHazard(state: TreadmillState): TreadmillHazard | undefined {
  return state.hazards.find(hazard => !hazard.hit && !hazard.passed && hazard.x > state.x)
}

export type TreadmillWarningTone = "neutral" | "caution" | "danger"

export function treadmillWarning(state: TreadmillState): { text: string; tone: TreadmillWarningTone } {
  if (state.mode !== "running") return { text: state.message, tone: state.mode === "over" ? "danger" : "neutral" }
  if (state.x < TREADMILL_RULES.warnRear) return { text: "뒤쪽 끝! 달리거나 대시", tone: "danger" }
  if (state.exhausted) return { text: "에너지 0 · 손을 놓아야 회복돼요", tone: "danger" }
  const ahead = nearestHazard(state)
  if (ahead && ahead.x - state.x < 0.2) {
    return { text: ahead.kind === "spike" ? "가시! 점프" : "장애물! 점프", tone: ahead.kind === "spike" ? "danger" : "caution" }
  }
  if (state.hitFlash < 0.8) return { text: state.message, tone: "caution" }
  if (state.energy < state.jumpCost + 4) return { text: "에너지 부족 · 잠깐 놓고 회복", tone: "caution" }
  if (upcomingHazards(state).length > 0) return { text: "곧 장애물이 와요", tone: "neutral" }
  return { text: state.running ? "달리는 중" : "회복 중 · 뒤로 밀려요", tone: "neutral" }
}

/** One short, actionable lesson for the result screen, derived only from this run. */
export function treadmillTip(state: TreadmillState): string {
  if (state.mode === "clear") {
    if (state.stats.hits === 0) return "부딪힘 없이 완주했어요. 다른 강화 조합도 시험해 보세요."
    return `부딪힘 ${state.stats.hits}번. 장애물이 오기 전에 점프할 에너지를 남겨 보세요.`
  }
  if (state.failure === "spike") {
    return state.energy < state.jumpCost
      ? "점프할 에너지가 없었어요. 가시 전에 잠깐 놓아서 회복해 두세요."
      : "점프가 늦거나 빨랐어요. 가시가 캐릭터 바로 앞에 왔을 때 뛰어 보세요."
  }
  if (state.stats.restSeconds < 1) return "계속 달리기만 하면 에너지가 바닥나요. 앞쪽에 여유가 있을 때 손을 놓으세요."
  if (state.stats.lowestEnergy <= 1) return "에너지가 바닥났어요. 뒤쪽 끝에 닿기 전에, 앞쪽에서 미리 쉬어 두세요."
  return "뒤로 밀리는 동안 너무 오래 쉬었어요. 빨간 구역에 닿기 전에 다시 달리세요."
}
