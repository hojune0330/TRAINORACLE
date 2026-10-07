/** Fictional game balance only. No training, reward, account or health inputs. */
export const TREADMILL_RULES = {
  version: 1,
  stageSeconds: 10,
  maxEnergy: 80,
  startPosition: 0.53,
  fallEdge: 0.047,
  frontEdge: 0.9,
  runDrain: 4.1,
  recovery: 10,
  dashCost: 18,
  dashSeconds: 0.5,
  dashSpeed: 0.38,
  gravity: 940,
  jumpVelocity: 390,
  hazardSpeed: 0.22,
  collisionRadius: 0.028,
  collisionHeight: 25,
} as const

export const TREADMILL_STAGES = [
  { id: "track", name: "트랙", belt: 0.074, movement: 0.114, hazard: "barrier" },
  { id: "mud", name: "진흙", belt: 0.081, movement: 0.088, hazard: "barrier" },
  { id: "spikes", name: "가시밭", belt: 0.080, movement: 0.116, hazard: "spike" },
] as const

export const TREADMILL_UPGRADES = [
  { id: "grip", name: "접지 밑창", benefit: "진흙 감속 완화", cost: "점프 에너지 +2" },
  { id: "spring", name: "스프링 밑창", benefit: "점프 에너지 −3", cost: "대시 거리 −15%" },
  { id: "economy", name: "일정한 박자", benefit: "달리기 소모 −20%", cost: "대시 충전 +0.5초" },
] as const

export type TreadmillUpgrade = typeof TREADMILL_UPGRADES[number]["id"]
export type TreadmillMode = "ready" | "running" | "paused" | "upgrade" | "over" | "clear"
export type TreadmillCommand =
  | { type: "start" }
  | { type: "run"; held: boolean }
  | { type: "jump" }
  | { type: "dash" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "upgrade"; upgrade: TreadmillUpgrade }

export type TreadmillState = {
  mode: TreadmillMode
  stage: number
  seconds: number
  x: number
  y: number
  velocityY: number
  energy: number
  running: boolean
  dashLeft: number
  cooldown: number
  invulnerable: number
  hazards: { x: number; hit: boolean }[]
  nextHazard: number
  upgrades: TreadmillUpgrade[]
  grip: number
  jumpCost: number
  dashFactor: number
  runDrainFactor: number
  cooldownSeconds: number
  message: string
}

export function newTreadmillRun(): TreadmillState {
  return {
    mode: "ready", stage: 0, seconds: 0, x: TREADMILL_RULES.startPosition,
    y: 0, velocityY: 0, energy: TREADMILL_RULES.maxEnergy, running: false,
    dashLeft: 0, cooldown: 0, invulnerable: 0, hazards: [], nextHazard: 2.4,
    upgrades: [], grip: 0, jumpCost: 10, dashFactor: 1, runDrainFactor: 1,
    cooldownSeconds: 2.5, message: "달려서 앞쪽 공간을 벌고, 잠깐 놓아서 회복하세요.",
  }
}

export function treadmillCommand(state: TreadmillState, command: TreadmillCommand): TreadmillState {
  if (command.type === "start") {
    return { ...newTreadmillRun(), mode: "running", message: "달리기를 놓으면 회복하지만 뒤로 밀립니다." }
  }
  if (command.type === "pause" && state.mode === "running") {
    return { ...state, mode: "paused", running: false, message: "일시정지 · 계속을 누르면 출발합니다." }
  }
  if (command.type === "resume" && state.mode === "paused") {
    return { ...state, mode: "running", running: false, message: "다음 장애물과 뒤쪽 끝을 살펴보세요." }
  }
  if (command.type === "upgrade" && state.mode === "upgrade") {
    const next = { ...state, upgrades: [...state.upgrades, command.upgrade] }
    if (command.upgrade === "grip") { next.grip += 0.026; next.jumpCost += 2 }
    if (command.upgrade === "spring") { next.jumpCost = Math.max(2, next.jumpCost - 3); next.dashFactor *= 0.85 }
    if (command.upgrade === "economy") { next.runDrainFactor *= 0.8; next.cooldownSeconds += 0.5 }
    return {
      ...next, stage: state.stage + 1, seconds: 0, x: TREADMILL_RULES.startPosition,
      y: 0, velocityY: 0, energy: Math.min(TREADMILL_RULES.maxEnergy, state.energy + 25),
      hazards: [], nextHazard: 2.4, dashLeft: 0, cooldown: 0, invulnerable: 0,
      mode: "paused", running: false, message: "다음 구간 · 계속을 누르면 출발합니다.",
    }
  }
  if (state.mode !== "running") return state
  switch (command.type) {
    case "run": return { ...state, running: command.held }
    case "jump": return state.y === 0 && state.energy >= state.jumpCost
      ? { ...state, energy: state.energy - state.jumpCost, y: 0.1, velocityY: TREADMILL_RULES.jumpVelocity }
      : state
    case "dash": return state.cooldown === 0 && state.energy >= TREADMILL_RULES.dashCost
      ? { ...state, energy: state.energy - TREADMILL_RULES.dashCost, dashLeft: TREADMILL_RULES.dashSeconds, cooldown: state.cooldownSeconds }
      : state
    default: return state
  }
}

function step(state: TreadmillState, dt: number): TreadmillState {
  const rules = TREADMILL_RULES
  const stage = TREADMILL_STAGES[state.stage]!
  const next = { ...state, hazards: state.hazards.map(hazard => ({ ...hazard })) }
  next.seconds += dt
  next.cooldown = Math.max(0, state.cooldown - dt)
  next.invulnerable = Math.max(0, state.invulnerable - dt)
  const runningSeconds = state.running ? Math.min(dt, state.energy / (rules.runDrain * state.runDrainFactor)) : 0
  const dashSeconds = Math.min(dt, state.dashLeft)
  next.dashLeft = Math.max(0, state.dashLeft - dt)
  // Holding an exhausted run button does not silently regenerate between frames.
  next.energy = state.running
    ? Math.max(0, state.energy - runningSeconds * rules.runDrain * state.runDrainFactor)
    : Math.min(rules.maxEnergy, state.energy + dt * rules.recovery)
  next.x = Math.min(rules.frontEdge, state.x - stage.belt * dt
    + runningSeconds * (stage.movement + (stage.id === "mud" ? state.grip : 0))
    + dashSeconds * rules.dashSpeed * state.dashFactor)
  if (state.y > 0 || state.velocityY > 0) {
    next.velocityY -= rules.gravity * dt
    next.y = Math.max(0, state.y + next.velocityY * dt)
    if (next.y === 0) next.velocityY = 0
  }
  if (next.seconds >= next.nextHazard && next.seconds < 7.1) {
    next.hazards.push({ x: 1.03, hit: false }); next.nextHazard += 3.7
  }
  for (const hazard of next.hazards) {
    const previousGap = hazard.x - state.x
    hazard.x -= rules.hazardSpeed * dt
    const gap = hazard.x - next.x
    const crossed = previousGap > 0 && gap <= 0
    if (!hazard.hit && (Math.abs(gap) < rules.collisionRadius || crossed)
      && Math.min(state.y, next.y) < rules.collisionHeight && next.invulnerable === 0) {
      hazard.hit = true
      if (stage.hazard === "spike") {
        return { ...next, mode: "over", running: false, message: "가시에 닿았어요. 다시 도전할 수 있어요." }
      }
      next.x -= 0.13
      next.energy = Math.max(0, next.energy - 10)
      next.invulnerable = 1
      next.message = "장애물에 부딪혀 뒤로 밀렸어요."
    }
  }
  next.hazards = next.hazards.filter(hazard => hazard.x > -0.06)
  if (next.x < rules.fallEdge) return { ...next, mode: "over", running: false, message: "뒤쪽 끝에서 떨어졌어요. 다시 도전할 수 있어요." }
  if (next.seconds >= rules.stageSeconds) {
    const clear = next.stage === TREADMILL_STAGES.length - 1
    return { ...next, seconds: rules.stageSeconds, mode: clear ? "clear" : "upgrade", running: false,
      message: clear ? "세 구간 완주! 다른 조합으로 다시 달려 보세요." : "안전 발판 도착 · 강화하는 동안 바닥이 멈춥니다." }
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

export function treadmillWarning(state: TreadmillState): string {
  if (state.mode !== "running") return state.message
  if (state.x < 0.23) return "뒤쪽 끝이 가까워요!"
  if (state.energy < 18) return "에너지 부족 · 앞쪽에서 잠깐 회복하세요."
  if (state.hazards.some(hazard => !hazard.hit && hazard.x > state.x && hazard.x - state.x < 0.23)) {
    return TREADMILL_STAGES[state.stage]!.hazard === "spike" ? "앞에 가시 · 안전한 곳으로 점프!" : "앞에 장애물 · 점프!"
  }
  return state.invulnerable > 0 ? state.message : "달리기를 놓으면 회복 · 뒤로 밀립니다."
}
