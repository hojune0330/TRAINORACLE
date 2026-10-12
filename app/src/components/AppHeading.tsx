import { forwardRef, type HTMLAttributes } from "react"

type AppHeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  readonly as?: "h1" | "h2" | "h3"
  readonly variant?: "screen" | "hero" | "section"
  readonly accent?: boolean
}

/** Visual role is independent of document level; focus and labels stay native. */
export const AppHeading = forwardRef<HTMLHeadingElement, AppHeadingProps>(function AppHeading({
  as: Heading = "h1",
  variant = "screen",
  accent = false,
  className,
  ...props
}, ref) {
  const classes = ["app-heading", `app-heading--${variant}`, accent && "app-heading--accent", className]
    .filter(Boolean).join(" ")
  return <Heading {...props} ref={ref} className={classes} />
})
