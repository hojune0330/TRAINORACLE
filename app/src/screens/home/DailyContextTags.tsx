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

export function DailyContextTags({ date, bodyOnly = false }: { readonly date: string; readonly bodyOnly?: boolean }) {
  const empty = (): DailyContext => ({ date, mood: null, body: null, weather: null })
  const read = () => { try { return loadDailyContext(date) ?? empty() } catch { return empty() } }
  const [context, setContext] = React.useState<DailyContext>(read)
  const [saveMessage, setSaveMessage] = React.useState("")
  const [saveFailed, setSaveFailed] = React.useState(false)
  React.useEffect(() => {
    setContext(read()); setSaveMessage(""); setSaveFailed(false)
    const refresh = () => setContext(read())
    window.addEventListener("storage", refresh)
    window.addEventListener("trainoracle:daily-context-changed", refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener("trainoracle:daily-context-changed", refresh)
    }
  }, [date])

  const update = (patch: Partial<Pick<DailyContext, "mood" | "body" | "weather">>) => {
    // Another view may have saved mood or weather since this view was opened.
    let current: DailyContext
    try { current = loadDailyContext(date) ?? empty() }
    catch { setSaveFailed(true); setSaveMessage("저장 공간을 열지 못했어요. 선택은 바꾸지 않았어요."); return }
    const next = { ...current, ...patch }
    if (saveDailyContext(next)) {
      setContext(next); setSaveFailed(false); setSaveMessage("이 기기에 오늘의 상태를 저장했어요.")
      window.dispatchEvent(new Event("trainoracle:daily-context-changed"))
    } else {
      setSaveFailed(true); setSaveMessage("저장하지 못했어요. 선택을 다시 눌러 주세요.")
    }
  }

  return (
    <section className="daily-context" aria-label={bodyOnly ? "오늘의 몸 상태" : "오늘의 기분 몸 상태 날씨"}>
      {!bodyOnly && <TagGroup title="기분" values={MOODS} selected={context.mood} onSelect={(mood) => update({ mood })} />}
      <TagGroup title="몸 상태" values={BODIES} selected={context.body} onSelect={(body) => update({ body })} />
      {bodyOnly && <button type="button" onClick={() => update({ body: null })} aria-pressed={context.body === null}>모르겠어요 · 비워 두기</button>}
      {!bodyOnly && <TagGroup title="날씨" values={WEATHER} selected={context.weather} onSelect={(weather) => update({ weather })} />}
      {saveMessage && <p role={saveFailed ? "alert" : "status"}>{saveMessage}</p>}
      {!bodyOnly && <p>날씨는 직접 골라요. 위치정보를 사용하지 않아요.</p>}
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
    <div className="daily-context__group" role="group" aria-label={title}>
      <span className="daily-context__label">{title}</span>
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
    </div>
  )
}
