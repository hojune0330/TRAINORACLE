/** Presentation only: engine x is progress on the belt, lane is the participant's slot. */
export function survivalPoint(x: number, lane: number, width: number, height: number, time = 0, reduced = false, curve = false) {
  const depth = Math.pow(Math.max(0, Math.min(1, x / 1.2)), .85)
  const scale = 1 - .62 * depth
  const bend = curve ? Math.sin(depth * Math.PI) * .06 : 0
  const sway = reduced ? 0 : Math.sin(time * .45) * 3 * depth
  return { x: width * (.48 + .12 * depth + bend + lane * .21 * scale) + sway,
    y: height * (.89 - .50 * depth), scale }
}
