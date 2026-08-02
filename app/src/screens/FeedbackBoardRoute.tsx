import React from "react"

type FeedbackBoardModule = typeof import("./FeedbackBoard")

type FeedbackBoardRouteProps = {
  readonly load?: () => Promise<FeedbackBoardModule>
}

const defaultLoader = () => import("./FeedbackBoard")

export function FeedbackBoardRoute({ load = defaultLoader }: FeedbackBoardRouteProps) {
  const LazyFeedbackBoard = React.useMemo(
    () => React.lazy(async () => {
      const module = await load()
      return { default: module.FeedbackBoard }
    }),
    [load],
  )

  return (
    <React.Suspense fallback={<main className="feedback-board"><p>문의 게시판을 여는 중…</p></main>}>
      <LazyFeedbackBoard />
    </React.Suspense>
  )
}
