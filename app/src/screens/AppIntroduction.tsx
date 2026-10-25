import { useState, type MouseEvent } from "react"
import { Calculator, CalendarDays, ChartNoAxesCombined, Gamepad2, NotebookPen, Sticker } from "lucide-react"
import { AppHeading } from "../components/AppHeading"
import { CategoryCard, CategoryIcon, type AppCategory } from "../components/CategoryCard"
import "../styles/app-introduction.css"

type AppIntroductionProps = {
  readonly onOpenPlan?: () => void
  readonly onOpenJournal?: () => void
  readonly onOpenRewards?: () => void
  readonly onOpenAnalysis?: () => void
  readonly onOpenPaceCalculator?: () => void
  readonly onOpenMinigame?: () => void
}

/** A replayable introduction. Opening a destination does not create or save a record. */
export function AppIntroduction({ onOpenPlan, onOpenJournal, onOpenRewards,
  onOpenAnalysis, onOpenPaceCalculator, onOpenMinigame }: AppIntroductionProps) {
  const [artworkAvailable, setArtworkAvailable] = useState(true)
  const open = (action: () => void) => (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.focus({ preventScroll: true })
    action()
  }
  const extras = [
    { label: "운동 분석", icon: ChartNoAxesCombined, category: "oracle" as AppCategory, action: onOpenAnalysis },
    { label: "페이스 계산기", icon: Calculator, category: "training" as AppCategory, action: onOpenPaceCalculator },
    { label: "게임 라운지", icon: Gamepad2, category: "home" as AppCategory, action: onOpenMinigame },
  ].filter(item => item.action !== undefined)

  return <section className="app-introduction" aria-labelledby="app-introduction-purpose">
    <div className="app-introduction__welcome">
      <AppHeading as="h2" variant="screen" id="app-introduction-purpose">
        훈련 계획을 받아보고, <br />러닝 일지를 꾸며요
      </AppHeading>
      <p>달릴 계획을 고르고, 오늘의 기록과 느낌을 남겨요.</p>
      {artworkAvailable && <img className="app-introduction__art"
        src={`${import.meta.env.BASE_URL}illustrations/app-introduction/running-journal-hero-v1.webp`}
        alt="" width={900} height={600} decoding="async"
        onError={() => setArtworkAvailable(false)} />}
    </div>

    {(onOpenPlan || onOpenJournal) && <nav className="app-introduction__start" aria-label="앱의 주요 기능">
      {onOpenPlan && <CategoryCard category="training" icon={CalendarDays}
        title="훈련 계획 받아보기" aria-label="훈련 계획 받아보기"
        description="목표를 고르고, 앞으로 할 훈련을 살펴요."
        onClick={open(onOpenPlan)} />}
      {onOpenJournal && <CategoryCard category="journal" icon={NotebookPen}
        title="러닝 일지 쓰기" aria-label="러닝 일지 쓰기"
        description="얼마나 달렸는지, 오늘 어땠는지 남겨요."
        onClick={open(onOpenJournal)} />}
    </nav>}

    <div className="app-introduction__decoration">
      <CategoryIcon category="journal" icon={Sticker} />
      <div>
        <AppHeading as="h3" variant="section">일지도 내 취향대로</AppHeading>
        <p>스티커와 글씨를 더해 나만의 일지를 만들어요.</p>
        {onOpenRewards && <button type="button" className="app-introduction__decoration-action"
          onClick={open(onOpenRewards)}>꾸미기 둘러보기</button>}
      </div>
    </div>

    {extras.length > 0 && <section className="app-introduction__extras" aria-labelledby="app-introduction-extras">
      <AppHeading as="h3" variant="section" id="app-introduction-extras">이런 것도 할 수 있어요</AppHeading>
      <nav aria-label="다른 기능 둘러보기">
        {extras.map(({ label, icon, category, action }) => <button type="button" key={label}
          onClick={open(action!)}>
          <CategoryIcon category={category} icon={icon} />
          <span>{label}</span>
        </button>)}
      </nav>
    </section>}
  </section>
}
