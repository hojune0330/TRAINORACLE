import type { ButtonHTMLAttributes } from "react"
import "./next-action.css"

/** Immediate visual feedback only; native click still owns the action. */
export const nextActionFeedback: Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onPointerDown" | "onPointerLeave" | "onBlur"> = {
  onPointerDown(event) {
    const button = event.currentTarget
    if (button.disabled || event.button !== 0 || !button.classList.contains("next-action")) return
    button.dataset.pressed = "true"
    const clear = () => {
      delete button.dataset.pressed
      window.removeEventListener("pointerup", clear)
      window.removeEventListener("pointercancel", clear)
      window.removeEventListener("blur", clear)
    }
    window.addEventListener("pointerup", clear, { once: true })
    window.addEventListener("pointercancel", clear, { once: true })
    window.addEventListener("blur", clear, { once: true })
  },
  onPointerLeave(event) { delete event.currentTarget.dataset.pressed },
  onBlur(event) { delete event.currentTarget.dataset.pressed },
}
