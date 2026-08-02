import React from "react"
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  Flag,
  HeartPulse,
  LockKeyhole,
  PencilLine,
  Upload,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { JournalEntryType } from "../log-entry/shared"

export type FirstVisitStep = "welcome" | "context"

type FirstPageProps = {
  readonly initialStep?: FirstVisitStep
  readonly onWriteLog?: (entryType?: JournalEntryType) => void
  readonly onOpenPlan?: () => void
  readonly onDismiss?: () => void
  /** 내려받은 백업 되돌리기 — 반대로 일지가 뱄 상황이 복원이 가장 필요한 순간이다 */
  readonly onOpenRestore?: () => void
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
  onOpenRestore,
}: FirstPageProps) {
  const [step, setStep] = React.useState<FirstVisitStep>(initialStep)
  const frameRef = React.useRef<HTMLElement>(null)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const didMount = React.useRef(false)

  React.useEffect(() => {
    if (didMount.current) {
      frameRef.current?.scrollIntoView?.({ block: "start" })
      headingRef.current?.focus()
    }
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
        label: "하루와 몸 상태를 기록할래요",
        detail: "수면·기분·통증을 확인해요",
        icon: HeartPulse,
        action: () => onWriteLog?.("evening"),
      },
      {
        label: "경기를 기록할래요",
        detail: "경기 전후의 기록과 느낌을 남겨요",
        icon: Flag,
        action: () => onWriteLog?.("race"),
      },
    ]

    return (
      <FirstVisitFrame rootRef={frameRef}>
        <div className="first-visit__utility">
          <BackButton onClick={() => setStep("welcome")} />
          <button className="first-visit__skip" type="button" onClick={onDismiss}>홈 둘러보기</button>
        </div>
        <div className="first-visit__content">
          <div className="first-visit__eyebrow">시작 방법</div>
          <h1 ref={headingRef} tabIndex={-1} className="first-visit__title">무엇을 남길까요?</h1>
          <p className="first-visit__copy">고르면 바로 기록 화면으로 이동해요. 이 선택 자체는 저장하지 않아요.</p>
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
    <FirstVisitFrame rootRef={frameRef}>
      <div className="first-visit__utility">
        <div className="first-visit__brand">TRAINORACLE</div>
        <button className="first-visit__skip" type="button" onClick={onDismiss}>홈 먼저 둘러보기</button>
      </div>
      <div className="first-visit__content first-visit__content--welcome">
        <div className="first-visit__eyebrow">오늘의 훈련 데스크</div>
        <h1 ref={headingRef} className="first-visit__title">오늘 기록을 시작할까요?</h1>
        <p className="first-visit__copy">훈련·회복·경기 중 하나를 골라 남겨요.</p>
        <button className="first-visit__primary" type="button" onClick={() => setStep("context")}>
          <PencilLine aria-hidden="true" size={19} />
          <span>오늘 기록 시작하기</span>
          <ChevronRight aria-hidden="true" size={18} />
        </button>
        <button className="first-visit__secondary" type="button" onClick={onOpenPlan}>
          <CalendarClock aria-hidden="true" size={18} />
          훈련계획 먼저 보기
        </button>
        <div className="first-visit__trust">
          <LockKeyhole aria-hidden="true" size={15} />
          <span>회원가입 없이 이 브라우저에 저장돼요.</span>
        </div>
        {onOpenRestore && (
          <button className="first-visit__text-action" type="button" onClick={onOpenRestore}>
            <Upload aria-hidden="true" size={16} />백업 불러오기
          </button>
        )}
        <p className="first-visit__device-note">공용 기기에서는 통증·메모를 남기지 마세요. 브라우저 데이터를 지우면 기록도 사라질 수 있어요.</p>
      </div>
    </FirstVisitFrame>
  )
}

export function EmptyJournalHome({
  onWriteLog,
  onOpenPlan,
  onOpenRestore,
}: Pick<FirstPageProps, "onWriteLog" | "onOpenPlan" | "onOpenRestore">) {
  return (
    <div className="empty-journal-home">
      <div className="first-visit__eyebrow">MY JOURNAL</div>
      <h1 className="empty-journal-home__title">아직 기록이 없어요.</h1>
      <p className="first-visit__copy">오늘 기록을 남기거나, 전에 저장한 백업을 불러올 수 있어요.</p>
      <button className="first-visit__primary" type="button" onClick={() => onWriteLog?.()}>
        <PencilLine aria-hidden="true" size={19} />
        <span>오늘 기록 시작하기</span>
        <ChevronRight aria-hidden="true" size={18} />
      </button>
      <button className="first-visit__secondary" type="button" onClick={onOpenPlan}>
        <CalendarClock aria-hidden="true" size={18} />
        훈련계획 먼저 보기
      </button>
      {onOpenRestore && (
        <button
          className="empty-journal-home__restore"
          type="button"
          data-testid="open-restore-empty"
          onClick={onOpenRestore}
        >
          <Upload aria-hidden="true" size={16} />
          전에 내려받은 백업이 있어요
        </button>
      )}
    </div>
  )
}

function FirstVisitFrame({ children, rootRef }: {
  readonly children: React.ReactNode
  readonly rootRef?: React.Ref<HTMLElement>
}) {
  return (
    <section ref={rootRef} className="first-visit" aria-label="TrainOracle 시작">
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
