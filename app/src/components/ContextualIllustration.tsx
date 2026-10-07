import { useState } from "react"
import "../styles/contextual-illustration.css"

const imageFiles = {
  "journal-guide": "mari-journal-guide.webp",
  "watch-file": "watch-file-guide-v1.webp",
  "empty-journal": "journal-empty-illustration.webp",
  "training-track": "training-track-break-v1.webp",
  "plan-guide": "plan-guide-v1.webp",
  "decorating-kit": "decorating-kit-v1.webp",
  "mari-explain": "mari-explain.webp",
  "mari-thanks": "mari-thanks.webp",
} as const

interface ContextualIllustrationProps {
  readonly image: keyof typeof imageFiles
  readonly size?: "small" | "medium"
  readonly className?: string
}

/** Optional visual pause, never a training, health, ownership, or save-status signal. */
export function ContextualIllustration({ image, size = "small", className }: ContextualIllustrationProps) {
  const src = `${import.meta.env.BASE_URL || "/"}illustrations/${imageFiles[image]}`
  const [failedSource, setFailedSource] = useState<string | null>(null)
  if (failedSource === src) return null
  const pixels = size === "medium" ? 80 : 64

  return <img
    className={["contextual-illustration", `contextual-illustration--${size}`, className].filter(Boolean).join(" ")}
    src={src}
    alt=""
    aria-hidden="true"
    width={pixels}
    height={pixels}
    loading="lazy"
    decoding="async"
    draggable={false}
    onError={() => setFailedSource(src)}
  />
}
