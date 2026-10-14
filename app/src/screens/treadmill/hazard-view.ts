import { TREADMILL_RULES } from "../../domain/minigame/treadmill"
import type { TreadmillHazard, TreadmillState } from "../../domain/minigame/treadmill"

/** Camera look-ahead can reveal the course beyond the engine's activation line.
 * Continue each scheduled obstacle backwards along its path instead of materializing
 * it at that line. These previews never enter collision, score or saved state. */
export function presentedHazards(state: TreadmillState): (TreadmillHazard & { scheduled: boolean })[] {
  const { hazardEntry, hazardSpeed } = TREADMILL_RULES
  return [
    ...state.hazards.map(hazard => ({ ...hazard, scheduled: false })),
    ...state.stages[state.stage]!.course.slice(state.spawned).map((item, index) => ({
      id: state.stage * 100 + state.spawned + index, kind: item.kind,
      x: hazardEntry + Math.max(0, item.at - state.seconds) * hazardSpeed,
      hit: false, passed: false, scheduled: true,
    })),
  ]
}
