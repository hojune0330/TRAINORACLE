import React from "react"
import { loadDailyContext, saveDailyContext } from "../../domain/daily-context"
import type { DailyContext } from "../../domain/daily-context"

const MOODS = [
  { value: "LOW", label: "낮음" },
  { value: "OKAY", label: "괜찮음" },
  { value: "GOOD", label: "좋음" },
] as const
const BODIES = [
  { value: "TIRED", label: "피곤" },
  { value: "NORMAL", label: "보통" },
  { value: "LIGHT", label: "가벼움" },
] as const
const WEATHER = [
  { value: "SUNNY", label: "맑음" },
  { value: "CLOUDY", label: "흐림" },
  { value: "RAINY", label: "비" },
  { value: "COLD", label: "추움" },
  { value: "HOT", label: "더움" },
] as const

export function DailyContextTags({ date }: { readonly date: string }) {
  const [context, setContext] = React.useState<DailyContext>(() => loadDailyContext(date) ?? {
    date,
    mood: null,
    body: null,
    weather: null,
  })

  const update = (patch: Partial<Pick<DailyContext, "mood" | "body" | "weather">>) => {
    const next = { ...context, ...patch }
    if (saveDailyContext(next)) setContext(next)
  }

  return (
    <section className="daily-context" aria-label="오늘의 기분 몸 상태 날씨">
      <TagGroup title="기분" values={MOODS} selected={context.mood} onSelect={(mood) => update({ mood })} />
      <TagGroup title="몸 상태" values={BODIES} selected={context.body} onSelect={(body) => update({ body })} />
      <TagGroup title="날씨" values={WEATHER} selected={context.weather} onSelect={(weather) => update({ weather })} />
      <p>날씨는 직접 골라요. 위치정보를 사용하지 않아요.</p>
    </section>
  )
}

function TagGroup<T extends string>({
  title,
  values,
  selected,
  onSelect,
}: {
  readonly title: string
  readonly values: readonly { readonly value: T; readonly label: string }[]
  readonly selected: T | null
  readonly onSelect: (value: T) => void
}) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div>
        {values.map((item) => (
          <button
            type="button"
            aria-label={`${title} ${item.label}`}
            aria-pressed={selected === item.value}
            onClick={() => onSelect(item.value)}
            key={item.value}
          >
            {item.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
