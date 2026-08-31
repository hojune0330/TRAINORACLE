import React from "react"
import { orderedStepMotion } from "../domain/screen-motion"

export function useOrderedStepMotion<T extends string>(
  current: T,
  order: readonly T[],
): "initial" | "forward" | "backward" | "replace" {
  const previous = React.useRef<T | null>(null)
  const motion = orderedStepMotion(previous.current, current, order)
  React.useLayoutEffect(() => {
    previous.current = current
  }, [current])
  return motion
}
