import React from "react"
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  Eye,
  HeartPulse,
  PencilLine,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { JournalEntryType } from "../log-entry/shared"

export type FirstVisitStep = "welcome" | "context" | "plan"

type FirstPageProps = {
  readonly initialStep?: FirstVisitStep
  readonly onWriteLog?: (entryType?: JournalEntryType) => void
  readonly onOpenGuide?: () => void
  readonly onDismiss?: () => void
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
  onOpenGuide,
  onDismiss,
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
        detail: "훈련계획 기능 준비 현황을 확인해요",
        icon: CalendarClock,
        action: () => setStep("plan"),
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

  if (step === "plan") {
    return (
      <FirstVisitFrame rootRef={frameRef} onSkip={onDismiss}>
        <BackButton onClick={() => setStep("context")} />
        <div className="first-visit__content first-visit__content--centered">
          <div className="first-visit__plan-mark" aria-hidden="true">
            <CalendarClock size={34} strokeWidth={1.45} />
          </div>
          <div className="first-visit__eyebrow">SERVICE PREPARING</div>
          <h1 className="first-visit__title">훈련계획은 준비 중이에요</h1>
          <p className="first-visit__copy">
            안전 규칙과 선수의 기록을 확인한 뒤, 여러 후보 중 고르는 흐름을 만들고 있어요.
            아직 훈련계획 신청 화면은 열지 않았고, 이 화면에서는 선수 정보나 계획 요청을 받지 않아요.
          </p>
          <button className="first-visit__primary" type="button" onClick={() => onWriteLog?.()}>
            <PencilLine aria-hidden="true" size={19} />
            <span>오늘 기록부터 남기기</span>
            <ChevronRight aria-hidden="true" size={18} />
          </button>
          <button className="first-visit__text-action" type="button" onClick={() => setStep("context")}>
            <ArrowLeft aria-hidden="true" size={16} />
            이전 선택으로
          </button>
        </div>
      </FirstVisitFrame>
    )
  }

  return (
    <FirstVisitFrame rootRef={frameRef} onSkip={onDismiss}>
      <div className="first-visit__content first-visit__content--welcome">
        <div className="first-visit__brand">TRAINORACLE</div>
        <div className="first-visit__eyebrow">이 브라우저에만 저장 · 공용 기기 주의</div>
        <h1 className="first-visit__title">오늘의 훈련을 기록해볼까요?</h1>
        <p className="first-visit__copy">
          회원가입 없이 1분 만에 시작해요. 훈련한 날, 쉰 날, 아픈 날의 기록이 쌓이면
          거리·기분·통증의 변화를 실제 입력 기준으로 볼 수 있어요.
        </p>
        <div className="first-visit__promise">
          <PencilLine aria-hidden="true" size={21} strokeWidth={1.6} />
          <span>
            <strong>첫 기록은 짧아도 충분해요.</strong>
            <small>입력하지 않은 값은 분석에서 제외해요. 브라우저를 지우거나 기기를 바꾸기 전에는 내보내기로 백업하세요.</small>
          </span>
        </div>
        <button className="first-visit__primary" type="button" onClick={() => onWriteLog?.()}>
          <PencilLine aria-hidden="true" size={19} />
          <span>첫 일지 쓰기</span>
          <ChevronRight aria-hidden="true" size={18} />
        </button>
        <button className="first-visit__secondary" type="button" onClick={() => setStep("context")}>
          <Eye aria-hidden="true" size={18} />
          무엇을 할 수 있나요?
        </button>
        <button className="first-visit__guide" type="button" onClick={onOpenGuide}>
          쌓인 기록 예시 보기
        </button>
      </div>
    </FirstVisitFrame>
  )
}

export function EmptyJournalHome({
  onWriteLog,
  onOpenGuide,
}: Pick<FirstPageProps, "onWriteLog" | "onOpenGuide">) {
  return (
    <div className="empty-journal-home">
      <div className="first-visit__eyebrow">MY JOURNAL</div>
      <h1 className="empty-journal-home__title">아직 기록이 없어요.</h1>
      <p className="first-visit__copy">원할 때 짧게 시작하세요. 훈련하지 않은 날도 그대로 남길 수 있어요.</p>
      <button className="first-visit__primary" type="button" onClick={() => onWriteLog?.()}>
        <PencilLine aria-hidden="true" size={19} />
        <span>일지 쓰기</span>
        <ChevronRight aria-hidden="true" size={18} />
      </button>
      <button className="first-visit__secondary" type="button" onClick={onOpenGuide}>
        <Eye aria-hidden="true" size={18} />
        예시 보기
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
