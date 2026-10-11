import React from "react"
import { readDailyContext, updateDailyContext } from "../../domain/daily-context"
import type { DailyContext } from "../../domain/daily-context"
import { localAccountScopeSnapshot } from "../../domain/account/local-account-scope"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"

type DailyContextView = {
  readonly date: string
  readonly accountScope: string | null
  readonly status: "ready" | "unavailable"
  readonly context: DailyContext
}

function emptyContext(date: string): DailyContext {
  return { date, mood: null, body: null, weather: null }
}

function readView(date: string): DailyContextView {
  const accountScope = localAccountScopeSnapshot()
  const result = readDailyContext(date)
  return result.kind === "loaded"
    ? { date, accountScope, status: "ready", context: result.context ?? emptyContext(date) }
    : { date, accountScope, status: "unavailable", context: emptyContext(date) }
}

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
  const [view, setView] = React.useState<DailyContextView>(() => readView(date))
  const [saveMessage, setSaveMessage] = React.useState("")
  const [saveFailed, setSaveFailed] = React.useState(false)
  const currentScope = localAccountScopeSnapshot()
  const viewMatches = view.date === date && view.accountScope === currentScope
  const loadStatus = viewMatches ? view.status : "loading"
  const context = viewMatches && view.status === "ready" ? view.context : emptyContext(date)
  const visibleSaveMessage = viewMatches ? saveMessage : ""
  const visibleSaveFailed = viewMatches && saveFailed
  const retryRead = () => {
    setView(readView(date))
    setSaveMessage("")
    setSaveFailed(false)
  }

  React.useEffect(() => {
    const refresh = () => {
      const next = readView(date)
      setView(next)
      if (next.status === "unavailable") {
        setSaveMessage("")
        setSaveFailed(false)
      }
    }
    const refreshScope = () => {
      setView(readView(date))
      setSaveMessage("")
      setSaveFailed(false)
    }
    setSaveMessage("")
    setSaveFailed(false)
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener("trainoracle:daily-context-changed", refresh)
    const unsubscribeScope = onLocalJournalScopeChange(refreshScope)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener("trainoracle:daily-context-changed", refresh)
      unsubscribeScope()
    }
  }, [date])

  const update = (patch: Partial<Pick<DailyContext, "mood" | "body" | "weather">>) => {
    if (view.date !== date || view.accountScope !== localAccountScopeSnapshot()) {
      retryRead()
      return
    }
    if (view.status !== "ready") return
    const result = updateDailyContext(date, patch)
    if (result.kind === "read_unavailable") {
      setView(readView(date))
      setSaveMessage("")
      setSaveFailed(false)
      return
    }
    if (result.kind === "saved") {
      setView({ date, accountScope: localAccountScopeSnapshot(), status: "ready", context: result.context })
      setSaveFailed(false)
      setSaveMessage("이 기기에 오늘의 상태를 저장했어요.")
      window.dispatchEvent(new Event("trainoracle:daily-context-changed"))
    } else {
      setSaveFailed(true); setSaveMessage("저장하지 못했어요. 선택을 다시 눌러 주세요.")
    }
  }

  return (
    <section className="daily-context" aria-label={bodyOnly ? "오늘의 몸 상태" : "오늘의 기분 몸 상태 날씨"}>
      {!bodyOnly && <TagGroup title="기분" values={MOODS} selected={context.mood} disabled={loadStatus !== "ready"} onSelect={(mood) => update({ mood })} />}
      <TagGroup title="몸 상태" values={BODIES} selected={context.body} disabled={loadStatus !== "ready"} onSelect={(body) => update({ body })} />
      {bodyOnly && <button type="button" disabled={loadStatus !== "ready"} onClick={() => update({ body: null })} aria-pressed={loadStatus === "ready" && context.body === null}>모르겠어요 · 비워 두기</button>}
      {!bodyOnly && <TagGroup title="날씨" values={WEATHER} selected={context.weather} disabled={loadStatus !== "ready"} onSelect={(weather) => update({ weather })} />}
      {loadStatus === "loading" && <p role="status">오늘의 상태를 확인하고 있어요.</p>}
      {loadStatus === "unavailable" && <>
        <p role="alert">오늘의 상태를 불러오지 못했어요. 저장된 자료는 그대로 두었어요.</p>
        <button type="button" onClick={retryRead}>다시 불러오기</button>
      </>}
      {visibleSaveMessage && <p role={visibleSaveFailed ? "alert" : "status"}>{visibleSaveMessage}</p>}
      {!bodyOnly && <p>날씨는 직접 골라요. 위치정보를 사용하지 않아요.</p>}
    </section>
  )
}

function TagGroup<T extends string>({
  title,
  values,
  selected,
  disabled,
  onSelect,
}: {
  readonly title: string
  readonly values: readonly { readonly value: T; readonly label: string }[]
  readonly selected: T | null
  readonly disabled: boolean
  readonly onSelect: (value: T) => void
}) {
  return (
    <div className="daily-context__group" role="group" aria-label={title}>
      <span className="daily-context__label">{title}</span>
      <div className="app-choice-group">
        {values.map((item) => (
          <button
            className="app-choice-control"
            type="button"
            disabled={disabled}
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
