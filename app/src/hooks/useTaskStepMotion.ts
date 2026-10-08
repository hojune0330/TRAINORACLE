import React from "react"
import { useCalendarMotion } from "./useCalendarMotion"

export type TaskStepMotion = "initial" | "forward" | "backward" | "replace"

/** Animate the existing surface, never its identity or the form's state. */
export function useTaskStepMotion(
  stepKey: string,
  surfaceRef: React.RefObject<HTMLElement>,
  direction: TaskStepMotion = "replace",
): boolean {
  const { reduced } = useCalendarMotion()
  const previousKey = React.useRef(stepKey)
  const latestDirection = React.useRef(direction)
  latestDirection.current = direction

  React.useLayoutEffect(() => {
    if (previousKey.current === stepKey) return
    previousKey.current = stepKey
    const root = surfaceRef.current
    // Directional flows mark a surface inside their existing safe padding.
    // Never slide the full-width viewport or clip focus rings to hide overflow.
    const surface = root?.querySelector<HTMLElement>("[data-task-motion-surface]") ?? root
    if (!surface || reduced || typeof surface.animate !== "function") return

    const motion = latestDirection.current
    const offset = motion === "forward" ? 8 : motion === "backward" ? -8 : 0
    const easing = window.getComputedStyle(surface).getPropertyValue("--ease-out-strong").trim() || "ease-out"
    const frames: Keyframe[] = offset === 0
      ? [{ opacity: 0.65 }, { opacity: 1 }]
      : [{ opacity: 0.65, transform: `translateX(${offset}px)` }, { opacity: 1, transform: "none" }]
    const animation = surface.animate(frames, { duration: 200, easing })
    return () => { animation.cancel() }
  }, [stepKey, surfaceRef, reduced])
  return reduced
}
