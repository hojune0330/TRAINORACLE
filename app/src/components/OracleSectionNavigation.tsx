import { ArrowLeft, Plus } from "lucide-react"
import { useDomainNavigation } from "./DomainNavigation"
import "../styles/oracle-section-navigation.css"

export type OracleHubSection = "training" | "profile" | "library"

/** One stable navigation surface for all three Oracle destinations. */
export function OracleSectionNavigation({ current, onSelect, onBack, backLabel = "뒤로", heading = false }: {
  readonly current: OracleHubSection
  readonly onSelect: (section: OracleHubSection) => void
  readonly onBack?: () => void
  readonly backLabel?: string
  readonly heading?: boolean
}) {
  const navigation = useDomainNavigation({ domain: "oracle", current, onSelect: section => {
    if (section === "training" || section === "profile" || section === "library") onSelect(section)
  } })
  const Title = heading ? "h1" : "span"
  return <div className="oracle-section-shell">
    <header className="oracle-section-header">
      {!navigation.managed && onBack && <button type="button" className="oracle-section-header__back" onClick={onBack} aria-label={backLabel}>
        <ArrowLeft size={16} aria-hidden="true" /><span>뒤로</span>
      </button>}
      <Title className="app-chrome-title">오라클</Title>
      {navigation.onRecord && <button type="button" className="oracle-section-header__record" aria-label="기록하기" onClick={navigation.onRecord}>
        <Plus size={22} aria-hidden="true" /><span>기록</span>
      </button>}
    </header>
  </div>
}
