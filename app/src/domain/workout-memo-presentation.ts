import { workoutMemoText, type WorkoutMemo, type WorkoutMemoLine } from "./workout-memo"
import { EXPLANATION_SOURCES } from "./training-explanation-profiles"

export type WorkoutMemoLayout = "full" | "compact"
export type WorkoutMemoView = "core" | "standard" | "method" | "explained"
export type WorkoutMemoGroup = "brief" | "detail"
export const WORKOUT_MEMO_GROUPS = [
  { id: "brief", label: "간단히" }, { id: "detail", label: "자세히" },
] as const
export const WORKOUT_MEMO_VIEWS = [
  { id: "core", group: "brief", label: "핵심만", layout: "compact" },
  { id: "standard", group: "brief", label: "기본", layout: "compact" },
  { id: "method", group: "detail", label: "방법", layout: "full" },
  { id: "explained", group: "detail", label: "설명까지", layout: "full" },
] as const satisfies readonly { readonly id: WorkoutMemoView; readonly group: WorkoutMemoGroup; readonly label: string; readonly layout: WorkoutMemoLayout }[]
export const WORKOUT_MEMO_WORDINGS = [
  { id: "PLAIN", label: "쉬운 말" }, { id: "COACH", label: "훈련 표기" },
] as const

export type WorkoutMemoPresentation = WorkoutMemo & { readonly layout: WorkoutMemoLayout; readonly view: WorkoutMemoView }

/** Legacy layout inputs remain aliases. Depth never changes the immutable prescription. */
export function presentWorkoutMemo(memo: WorkoutMemo, selection: WorkoutMemoView | WorkoutMemoLayout = "standard"): WorkoutMemoPresentation {
  const view = selection === "full" ? "method" : selection === "compact" ? "standard" : selection
  return { ...memo, view, layout: WORKOUT_MEMO_VIEWS.find(item => item.id === view)!.layout }
}

export function workoutMemoPresentationText(memo: WorkoutMemoPresentation): string {
  const text = workoutMemoText({ ...memo, lines: memoDisplayLines(memo) })
  const method = memo.layout === "full" ? `${text}\n수행 순서: ${memoExecutionOrder(memo)}` : text
  return memo.view !== "explained" ? method : [method, memo.explanation.scope,
    ...memo.explanation.sections.map(section => `${section.label}: ${section.text}`),
    `설명 버전: ${memo.explanation.version}`,
    ...memoExplanationSources(memo).map(source => `근거: ${source.title}${source.url ? ` (${source.url})` : ""}`),
  ].join("\n")
}

export function memoExecutionOrder(memo: WorkoutMemoPresentation): string {
  return [memo.lines.some(line => line.label === "준비") ? "준비" : null,
    memo.lines.some(line => line.label === "본운동") ? "본운동" : memo.lines[0]?.label,
    memo.lines.some(line => line.label === "정리") ? "정리" : null].filter(Boolean).join(" → ")
}

export function memoLineEmphasis(memo: WorkoutMemoPresentation, index: number): boolean {
  return Boolean(memoDisplayLines(memo)[index]?.emphasis) && (memo.layout === "full" || index === 0)
}

export function memoDisplayLines(memo: WorkoutMemoPresentation): readonly WorkoutMemoLine[] {
  if (memo.view === "core") {
    const main = memo.lines.find(line => line.label === "본운동")
    if (!main) return memo.lines
    const targets = memo.lines.filter(line => line.label === "목표" || line.label === "1회 목표")
    return [{ ...main, text: [main.text, ...targets.map(line => `${line.label}: ${line.text}`)].join(" · ") },
      ...memo.lines.filter(line => line !== main && !targets.includes(line))]
  }
  if (memo.layout === "full") return [
    ...memo.lines.filter(line => line.label === "준비"),
    ...memo.lines.filter(line => line.label !== "준비" && line.label !== "정리"),
    ...memo.lines.filter(line => line.label === "정리"),
  ]
  return memo.lines
}

export function memoExplanationSources(memo: WorkoutMemoPresentation): readonly { readonly title: string; readonly url: string | null }[] {
  return memo.explanation.sourceRefs.map(ref => {
    const source = EXPLANATION_SOURCES[ref]
    const path = source?.url ?? (/^(https:\/\/|(?:specs|reports)\/)/u.test(ref) ? ref : null)
    return { title: source?.title ?? ref, url: path === null ? null : path.startsWith("https://") ? path : `https://github.com/hojune0330/TRAINORACLE/blob/main/${path}` }
  })
}
