import React from "react"
import "./reward-actions.css"

export type RewardActionButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  readonly tone?: "primary" | "quiet"
}

/** Native activation and disabled semantics; feedback never grants a reward. */
export const RewardActionButton = React.forwardRef<HTMLButtonElement, RewardActionButtonProps>(
  function RewardActionButton({ tone = "primary", className = "", type = "button", ...props }, ref) {
    return <button {...props} ref={ref} type={type} className={`reward-action reward-action--${tone} ${className}`.trim()} />
  },
)
