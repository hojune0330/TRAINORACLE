import { treadmillElapsed } from "../../domain/minigame/treadmill"
import type { TreadmillState } from "../../domain/minigame/treadmill"

/** Presentation only: runner and hazards share one projection; no simulation state is changed. */
export function createRunnerCamera() {
  let offset = 0, lift = 0, travel = 0, speed = 0, elapsed = -1, stage = -1
  return (state: TreadmillState, width: number, height: number, reduced: boolean) => {
    const time = treadmillElapsed(state)
    const active = state.mode === "running" && state.countdown === 0
    const span = width * 1.4
    const anchor = state.dashLeft > 0 ? 0.48 : state.running ? 0.4 : 0.33
    // Near the rear boundary the runner can still visibly slip off the left side.
    const target = Math.max(0, state.x - anchor * width / span)
    const reset = elapsed < 0 || time < elapsed || stage !== state.stage || state.mode === "ready"
    const dt = reset || !active ? 0 : Math.min(0.05, Math.max(0, time - elapsed))
    const desiredSpeed = state.dashLeft > 0 ? 510 : state.running && !state.exhausted ? 220 : 105
    if (reset) { offset = target; lift = 0; travel = 0; speed = 0 }
    if (reduced) { offset = 0; lift = 0; travel = 0; speed = 0 }
    else if (active) {
      offset += (target - offset) * (1 - Math.exp(-dt * 5))
      lift += (state.y * (height < 320 ? 0.5 : 0.22) - lift) * (1 - Math.exp(-dt * 8))
      speed += (desiredSpeed - speed) * (1 - Math.exp(-dt * 8))
      travel += dt * speed
    }
    elapsed = time; stage = state.stage
    const beltWidth = reduced ? width * 0.86 : span
    const left = reduced ? width * 0.1 : -offset * span
    const floor = Math.min(height - 48, height * 0.79) + lift
    return { left, beltWidth, floor, travel, speed, offset, toPx: (x: number) => left + x * beltWidth }
  }
}
