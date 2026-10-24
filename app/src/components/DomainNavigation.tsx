import React from "react"
import { ArrowLeft, BookOpen, Gamepad2, Heart, HeartPulse, House, TrendingUp, Trophy } from "lucide-react"
import { useMeasuredTabBarHeight } from "./AppChrome"
import "../styles/domain-navigation.css"

export type NavigationDomain = "oracle" | "journal" | "games"
export type DomainSection = "training" | "profile" | "library" | "JOURNAL" | "BODY" | "games" | "records"
export type DomainDockState = {
  readonly domain: NavigationDomain
  readonly current: DomainSection
  readonly onSelect: (section: DomainSection) => void
  readonly hidden?: boolean
}
type DomainNavigationHost = {
  readonly active: boolean
  readonly onRecord: () => void
  readonly publish: (token: symbol, value: DomainDockState | null) => void
}
const Context = React.createContext<DomainNavigationHost | null>(null)

/** Screens describe their domain; only AppShellFrame renders a bottom slot. */
export function DomainNavigationProvider({ children, onRecord, publish }: {
  readonly children: React.ReactNode
  readonly onRecord: () => void
  readonly publish: DomainNavigationHost["publish"]
}) {
  const value = React.useMemo(() => ({ active: true, onRecord, publish }), [onRecord, publish])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

/** A retained, hidden page cannot own navigation or a native Back layer. */
export function DomainNavigationScope({ active, children }: { readonly active: boolean; readonly children: React.ReactNode }) {
  const parent = React.useContext(Context)
  const value = React.useMemo(() => parent ? { ...parent, active: parent.active && active } : null, [parent, active])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useDomainNavigation(state?: DomainDockState) {
  const host = React.useContext(Context)
  const token = React.useRef(Symbol("domain-dock"))
  const latest = React.useRef(state)
  latest.current = state
  const select = React.useCallback((section: DomainSection) => latest.current?.onSelect(section), [])
  const publish = host?.publish
  React.useLayoutEffect(() => {
    if (!publish || !host?.active || !state) return
    publish(token.current, { ...state, onSelect: select })
    return () => publish(token.current, null)
  }, [publish, host?.active, state?.domain, state?.current, state?.hidden, select])
  return { managed: host !== null, active: host?.active ?? true, onRecord: host?.onRecord }
}

const ITEMS = {
  oracle: [
    { id: "training", label: "분석", icon: TrendingUp, category: "oracle" },
    { id: "profile", label: "취향", icon: Heart, category: "oracle" },
    { id: "library", label: "읽을거리", icon: BookOpen, category: "oracle" },
  ],
  journal: [
    { id: "JOURNAL", label: "일지", icon: BookOpen, category: "journal" },
    { id: "BODY", label: "몸 기록", icon: HeartPulse, category: "body" },
  ],
  games: [
    { id: "games", label: "게임", icon: Gamepad2, category: "training" },
    { id: "records", label: "내 기록", icon: Trophy, category: "record" },
  ],
} as const
const NAMES = { oracle: "오라클", journal: "일지", games: "게임 라운지" } as const

export function DomainDock({ state, hasOrigin, onExit }: {
  readonly state: DomainDockState
  readonly hasOrigin: boolean
  readonly onExit: () => void
}) {
  const nav = useMeasuredTabBarHeight()
  const ExitIcon = hasOrigin ? ArrowLeft : House
  return <nav ref={nav} className="app-tab-bar app-navigation-dock" data-domain={state.domain}
    style={{ "--dock-columns": ITEMS[state.domain].length + 1 } as React.CSSProperties}
    aria-label={`${NAMES[state.domain]} 메뉴`}>
    <button type="button" className="app-tab-bar__button app-navigation-dock__exit"
      aria-label={hasOrigin ? `${NAMES[state.domain]} 나가기` : "홈"} onClick={onExit}>
      <ExitIcon size={22} aria-hidden="true" /><span>{hasOrigin ? "나가기" : "홈"}</span>
    </button>
    {ITEMS[state.domain].map(({ id, label, icon: Icon, category }) => <button key={id} type="button"
      className="app-tab-bar__button" data-category={category} data-active={state.current === id ? "true" : "false"}
      aria-current={state.current === id ? "page" : undefined}
      onClick={() => { if (state.current !== id) state.onSelect(id) }}>
      <Icon size={22} aria-hidden="true" /><span>{label}</span>
    </button>)}
  </nav>
}
