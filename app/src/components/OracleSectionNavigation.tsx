import { ArrowLeft, BookOpen, Calculator, Check, Heart, TrendingUp } from "lucide-react"
import { CategoryIcon } from "./CategoryCard"
import { useAppOverlayNavigation } from "./AppOverlayNavigation"
import "../styles/oracle-section-navigation.css"

const SECTIONS = [
  { id: "training", label: "내 훈련", icon: TrendingUp },
  { id: "profile", label: "러닝 취향", icon: Heart },
  { id: "library", label: "읽을거리", icon: BookOpen },
] as const
export type OracleHubSection = (typeof SECTIONS)[number]["id"]

/** One stable navigation surface for all three Oracle destinations. */
export function OracleSectionNavigation({ current, onSelect, onBack, backLabel = "뒤로", heading = false }: {
  readonly current: OracleHubSection
  readonly onSelect: (section: OracleHubSection) => void
  readonly onBack?: () => void
  readonly backLabel?: string
  readonly heading?: boolean
}) {
  const navigation = useAppOverlayNavigation()
  const Title = heading ? "h1" : "span"
  return <div className="oracle-section-shell">
    <header className="oracle-section-header">
      <button type="button" className="oracle-section-header__back" onClick={onBack} aria-label={backLabel}>
        <ArrowLeft size={16} aria-hidden="true" /><span>뒤로</span>
      </button>
      <Title className="app-chrome-title">오라클</Title>
      {navigation?.openPaceCalculator ? <button type="button" className="oracle-section-header__pace" onClick={() => navigation.openPaceCalculator?.()}>
        <Calculator size={16} aria-hidden="true" /><span>페이스 계산</span>
      </button> : <span aria-hidden="true" />}
    </header>
    <nav className="oracle-section-nav" aria-label="오라클 항목">
      {SECTIONS.map(item => <button key={item.id} type="button" className="oracle-section-nav__item" data-category="oracle"
        aria-current={current === item.id ? "page" : undefined}
        onClick={() => { if (current !== item.id) onSelect(item.id) }}>
        <CategoryIcon category="oracle" icon={item.icon} />
        <span className="oracle-section-nav__label">{item.label}</span>
        <Check size={16} className="oracle-section-nav__check" aria-hidden="true" />
      </button>)}
    </nav>
  </div>
}
