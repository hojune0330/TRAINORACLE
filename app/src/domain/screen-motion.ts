import type { AppTab } from "../components/AppChrome"

export type AppScreenMotion =
  | "initial"
  | "tab-forward"
  | "tab-backward"
  | "push"
  | "pop"
  | "replace"
  | "none"

export type AppScreenDescriptor = {
  readonly key: string
  readonly tab: AppTab
  readonly depth: number
}

const TAB_ORDER: readonly AppTab[] = ["home", "journal", "log", "plan", "trends"]

export function tabMotion(
  from: AppTab,
  to: AppTab,
): "tab-forward" | "tab-backward" | "replace" {
  if (from === to) return "replace"
  return TAB_ORDER.indexOf(to) > TAB_ORDER.indexOf(from)
    ? "tab-forward"
    : "tab-backward"
}

export function screenMotion(
  previous: AppScreenDescriptor | null,
  current: AppScreenDescriptor,
): AppScreenMotion {
  if (previous === null) return "initial"
  if (previous.key === current.key) return "none"
  if (previous.tab !== current.tab) return tabMotion(previous.tab, current.tab)
  if (current.depth > previous.depth) return "push"
  if (current.depth < previous.depth) return "pop"
  return "replace"
}

export function orderedStepMotion<T extends string>(
  previous: T | null,
  current: T,
  order: readonly T[],
): "initial" | "forward" | "backward" | "replace" {
  if (previous === null) return "initial"
  if (previous === current) return "replace"
  const previousIndex = order.indexOf(previous)
  const currentIndex = order.indexOf(current)
  if (previousIndex < 0 || currentIndex < 0) return "replace"
  return currentIndex > previousIndex ? "forward" : "backward"
}
