export function AppLoadingState({
  label = "화면을 준비하고 있어요.",
  fullScreen = false,
}: {
  readonly label?: string
  readonly fullScreen?: boolean
}) {
  return (
    <div
      className={`app-loading-state${fullScreen ? " app-loading-state--fullscreen" : ""}`}
      role="status"
      aria-live="polite"
    >
      <strong>TRAINORACLE</strong>
      <span>{label}</span>
      <i aria-hidden="true" />
    </div>
  )
}
