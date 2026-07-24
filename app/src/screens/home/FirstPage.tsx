import React from "react"
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  Eye,
  HeartPulse,
  PencilLine,
  Sparkles,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { JournalEntryType } from "../log-entry/shared"

export type FirstVisitStep = "welcome" | "context"

type FirstPageProps = {
  readonly initialStep?: FirstVisitStep
  readonly onWriteLog?: (entryType?: JournalEntryType) => void
  readonly onOpenPlan?: () => void
  readonly onDismiss?: () => void
  readonly oraclePoints?: number
}

type ContextChoice = {
  readonly label: string
  readonly detail: string
  readonly icon: LucideIcon
  readonly action: () => void
}

export function FirstPage({
  initialStep = "welcome",
  onWriteLog,
  onOpenPlan,
  onDismiss,
  oraclePoints = 0,
}: FirstPageProps) {
  const [step, setStep] = React.useState<FirstVisitStep>(initialStep)
  const frameRef = React.useRef<HTMLElement>(null)
  const didMount = React.useRef(false)

  React.useEffect(() => {
    if (didMount.current) frameRef.current?.scrollIntoView?.({ block: "start" })
    else didMount.current = true
  }, [step])

  if (step === "context") {
    const choices: readonly ContextChoice[] = [
      {
        label: "훈련을 기록하고 싶어요",
        detail: "거리·시간·강도를 남겨요",
        icon: Activity,
        action: () => onWriteLog?.("post-session"),
      },
      {
        label: "통증·컨디션을 남기고 싶어요",
        detail: "수면·기분·통증을 확인해요",
        icon: HeartPulse,
        action: () => onWriteLog?.("evening"),
      },
      {
        label: "훈련 계획이 궁금해요",
        detail: "7일 또는 9~10일 후보를 만들어요",
        icon: CalendarClock,
        action: () => onOpenPlan?.(),
      },
      {
        label: "그냥 둘러볼래요",
        detail: "기록 없이 홈을 살펴봐요",
        icon: Eye,
        action: () => onDismiss?.(),
      },
    ]

    return (
      <FirstVisitFrame rootRef={frameRef} onSkip={onDismiss}>
        <BackButton onClick={() => setStep("welcome")} />
        <div className="first-visit__content">
          <div className="first-visit__eyebrow">ONE QUICK CHOICE</div>
          <h1 className="first-visit__title">오늘 무엇 때문에 오셨나요?</h1>
          <p className="first-visit__copy">한 번만 고르면 바로 해당 화면으로 이동해요. 이 선택은 저장하지 않아요.</p>
          <div className="first-visit__choices">
            {choices.map(({ label, detail, icon: Icon, action }) => (
              <button className="first-visit__choice" type="button" onClick={action} key={label}>
                <Icon aria-hidden="true" size={20} strokeWidth={1.7} />
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
                <ChevronRight aria-hidden="true" size={18} strokeWidth={1.7} />
              </button>
            ))}
          </div>
        </div>
      </FirstVisitFrame>
    )
  }

  return (
    <FirstVisitFrame rootRef={frameRef} onSkip={onDismiss}>
      <div className="first-visit__content first-visit__content--welcome">
        <div className="first-visit__brand">TRAINORACLE</div>
        <div className="first-visit__eyebrow">이 브라우저에만 저장 · 공용 기기 주의</div>
        <h1 className="first-visit__title">오늘 무엇부터 시작할까요?</h1>
        <p className="first-visit__copy">
          일지 없이도 계획 후보부터 만들어요.
          <br />
          기록은 다음 주기에 참고돼요.
        </p>
        <div className="first-visit__promise">
          <PencilLine aria-hidden="true" size={21} strokeWidth={1.6} />
          <span>
            <strong>계획도 기록도 회원가입 없이 시작해요.</strong>
            <small>현재 베타 데이터는 이 브라우저에만 저장돼요. 통증이나 부상 여부가 불명확하면 계획 생성을 멈춰요.</small>
          </span>
        </div>
        <div className="first-visit__points" aria-label={`오라클 포인트 ${oraclePoints}점`}>
          <Sparkles aria-hidden="true" size={18} strokeWidth={1.7} />
          <span>
            <strong>오늘 방문으로 {oraclePoints}P가 쌓였어요.</strong>
            <small>일지를 쓴 날은 +4P · 휴식일과 통증 기록도 포함</small>
          </span>
        </div>
        <button className="first-visit__primary" type="button" onClick={onOpenPlan}>
          <CalendarClock aria-hidden="true" size={19} />
          <span>훈련계획 후보 만들기</span>
          <ChevronRight aria-hidden="true" size={18} />
        </button>
        <button className="first-visit__secondary" type="button" onClick={() => onWriteLog?.()}>
          <PencilLine aria-hidden="true" size={18} />
          첫 일지 쓰기
        </button>
        <button className="first-visit__guide" type="button" onClick={() => setStep("context")}>
          다른 시작 방법 보기
        </button>
      </div>
    </FirstVisitFrame>
  )
}

export function EmptyJournalHome({
  onWriteLog,
  onOpenPlan,
  oraclePoints = 0,
}: Pick<FirstPageProps, "onWriteLog" | "onOpenPlan" | "oraclePoints">) {
  return (
    <div className="empty-journal-home">
      <div className="first-visit__eyebrow">MY JOURNAL</div>
      <h1 className="empty-journal-home__title">아직 기록이 없어요.</h1>
      <p className="first-visit__copy">일지 없이 계획부터 만들거나, 오늘 기록을 짧게 남길 수 있어요.</p>
      <div className="first-visit__points" aria-label={`오라클 포인트 ${oraclePoints}점`}>
        <Sparkles aria-hidden="true" size={18} strokeWidth={1.7} />
        <span>
          <strong>{oraclePoints}P</strong>
          <small>방문 1P · 기록한 날 4P</small>
        </span>
      </div>
      <button className="first-visit__primary" type="button" onClick={onOpenPlan}>
        <CalendarClock aria-hidden="true" size={19} />
        <span>훈련계획 만들기</span>
        <ChevronRight aria-hidden="true" size={18} />
      </button>
      <button className="first-visit__secondary" type="button" onClick={() => onWriteLog?.()}>
        <PencilLine aria-hidden="true" size={18} />
        일지 쓰기
      </button>
    </div>
  )
}

function FirstVisitFrame({ children, onSkip, rootRef }: {
  readonly children: React.ReactNode
  readonly onSkip?: () => void
  readonly rootRef?: React.Ref<HTMLElement>
}) {
  return (
    <section ref={rootRef} className="first-visit" aria-label="TrainOracle 시작">
      <button className="first-visit__skip" type="button" aria-label="온보딩 건너뛰기" onClick={onSkip}>
        건너뛰기
      </button>
      {children}
    </section>
  )
}

function BackButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <button className="first-visit__back" type="button" aria-label="이전 화면으로" onClick={onClick}>
      <ArrowLeft aria-hidden="true" size={18} />
      이전
    </button>
  )
}
