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
  "plan-notebook": "plan-notebook-v2.webp",
  "journal-saved": "journal-saved-v2.webp",
  "running-shoe": "running-shoe-v2.webp",
  "analysis-lens": "analysis-lens-v2.webp",
  "watch-file-v2": "watch-file-v2.webp",
  "decorating-kit-v2": "decorating-kit-v2.webp",
  "training-map": "training-map-v3.webp",
  "pace-stopwatch": "pace-stopwatch-v3.webp",
  "record-stopwatch": "record-stopwatch-v3.webp",
  "plan-adjust": "plan-adjust-v3.webp",
  "mari-profile-hello": "mari-profile-hello-v4.webp",
  "mari-profile-explain": "mari-profile-explain-v4.webp",
  "mari-profile-wave": "mari-profile-wave-v4.webp",
  "preference-structure": "preference-structure-v1.webp",
  "preference-challenge": "preference-challenge-v1.webp",
  "preference-intensity": "preference-intensity-v1.webp",
  "preference-social": "preference-social-v1.webp",
  "preference-explore": "preference-explore-v1.webp",
  "preference-refresh": "preference-refresh-v1.webp",
} as const

export type ContextualIllustrationName = keyof typeof imageFiles

interface ContextualIllustrationProps {
  readonly image: ContextualIllustrationName
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
