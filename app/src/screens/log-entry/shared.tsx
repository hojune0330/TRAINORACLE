import React, { type ReactNode } from "react"
import { TermHelp } from "../../components/TermHelp"
import type { TermId } from "../../domain/glossary"
import type { JournalEntry } from "../../domain/journal-store"

export type JournalEntryType = "post-session" | "evening" | "race"

export interface EntryFormProps {
  readonly onBack?: () => void
  readonly onDone?: (entryType: JournalEntryType, savedEntry: JournalEntry, reviewMessage?: string) => void
  readonly targetDate?: string
  readonly initialEntry?: JournalEntry
}

const SECTION_LABEL_STYLE = {
  fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)",
  letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
} as const

let formSecSeq = 0

export interface SectionTouchOrder {
  /** 이 구획을 지금 건드렸다고 기록한다. 같은 구획을 연달아 불러도 안전하다. */
  readonly touch: (sectionId: string) => void
  /** 이 구획을 마지막으로 건드린 뒤 다른 구획을 건드렸는가. */
  readonly leftBehind: (sectionId: string) => boolean
}

/**
 * 구획을 건드린 순서를 기억한다.
 *
 * 왜 값이 아니라 순서인가 — 이걸 처음에 값으로 짰다가 틀렸다.
 * `RPE 를 골랐고 && 예상 강도에 값이 있다` 로 판정하면, 예상 강도를
 * 먼저 채운 사람이 RPE 를 누르는 **그 순간** RPE 가 접힌다. 오너가
 * 물리친 바로 그 동작이다 (작업지시서 UX1 D3: 방금 누른 값을 확인할 수
 * 없다). 실제 시험 하나가 정확히 그 순서로 눌렀다
 * (e2e/intensity-assessment.spec.ts:16-17 — 예상 강도 7 → RPE 8).
 *
 * "건드릴 때" 는 시점의 문제이므로 시점을 기록해야 한다. 값으로는 알 수 없다.
 */
export function useSectionTouchOrder(): SectionTouchOrder {
  const [order, setOrder] = React.useState<readonly string[]>([])
  const touch = React.useCallback((sectionId: string) => {
    // 같은 구획을 계속 건드리는 건 한 번으로 본다. 글자 하나마다 배열이
    // 길어지면 다시 그리기가 끝없이 일어난다.
    setOrder((current) => (current[current.length - 1] === sectionId ? current : [...current, sectionId]))
  }, [])
  const leftBehind = React.useCallback((sectionId: string) => {
    const lastTouch = order.lastIndexOf(sectionId)
    return lastTouch >= 0 && lastTouch < order.length - 1
  }, [order])
  return { touch, leftBehind }
}

/**
 * FormSec — 일지 입력 화면의 한 구획.
 *
 * 접기(collapsible)는 화면 길이를 줄이려고 넣었다 (작업지시서 UX1 §2).
 * 지켜야 할 규칙:
 * - `collapsible` 을 주지 않으면 예전과 완전히 같은 DOM 을 그린다.
 *   FormSec 을 쓰는 화면이 6개고 이번에 손대는 건 2개다. 나머지 4개를
 *   지키기 위해 기본값은 "접기 없음" 이다.
 * - 닫혀 있어도 children 은 DOM 에 그대로 둔다 (display:none).
 *   지우면 입력값이 사라진다. 접기는 보기 방식일 뿐이다.
 * - `autoOpenWhen` 은 펼치기만 한다. 한 번 열린 구획을 코드가 닫지 않는다.
 *
 * ## 자동 접기 — 오너 결정 2026-07-28
 *
 * 오너에게 "언제 접으면 자연스러운가" 를 물어 받은 답: **"건드릴 때."**
 * 즉 답을 넣은 순간이 아니라 **다음 구획을 건드린 순간** 접는다.
 *
 * 왜 "답을 넣은 순간" 이 아닌가 (작업지시서 UX1 D3 에서 폐기한 안):
 * RPE 를 고르는 순간 버튼 10개가 사라지면 자기가 7 을 눌렀는지 8 을
 * 눌렀는지 확인할 수 없다. 잘못 눌렀을 때 되돌릴 방법도 눈앞에서 사라진다.
 *
 * 왜 "다음 구획을 건드릴 때" 가 맞는가:
 * 사람이 다음 칸으로 넘어갔다는 것은 앞 구획을 끝냈다는 뜻이다. 이때
 * 접으면 (1) 방금 넣은 값을 확인할 시간이 있었고 (2) 접히는 게 눈이
 * 가 있는 곳(다음 구획) 위쪽에서 일어나므로 놀라지 않는다.
 *
 * 구현: `collapseWhenLeft` 가 `false → true` 로 바뀌면 접는다.
 * 그 판정("다음 구획을 건드렸다")은 **각 화면이** 한다. FormSec 은
 * 신호만 받는다 — 판정을 여기 넣으면 화면마다 다른 규칙이 섞인다.
 * 판정에는 `useSectionTouchOrder` 를 쓴다. 값이 아니라 **건드린 순서** 로
 * 재야 하는 이유는 그 함수 주석에 적어 뒀다.
 *
 * 안전 규칙 세 개:
 * - 사람이 손으로 펼친 구획은 접지 않는다 (`openedByHuman`).
 *   사람이 연 것을 코드가 닫으면 조작을 빼앗긴 느낌이 된다.
 * - 한 번 접은 뒤에는 다시 접지 않는다. 펼쳐서 고치는 중에 또 접히면
 *   같은 동작을 반복하게 된다.
 * - `summary` 가 없으면 접지 않는다. 접힌 줄에 아무 값도 안 보이면
 *   무엇을 넣었는지 알 수 없어 다시 펼쳐야 한다.
 */
export function FormSec({
  lb, help, children,
  collapsible = false,
  defaultOpen = true,
  autoOpenWhen,
  collapseWhenLeft,
  onTouch,
  summary,
  expandHint = "펼치기",
}: {
  readonly lb: string
  readonly help?: TermId
  readonly children: ReactNode
  /** 접기 기능을 켠다. 주지 않으면 예전과 같은 DOM 이다. */
  readonly collapsible?: boolean
  /** 처음 열려 있는지. `collapsible` 일 때만 쓴다. */
  readonly defaultOpen?: boolean
  /** true 로 바뀌는 순간 펼친다. 닫는 데는 쓰지 않는다. */
  readonly autoOpenWhen?: boolean
  /**
   * "사람이 다음 구획으로 넘어갔다" 는 신호. `false → true` 로 바뀔 때
   * 한 번 접는다 (오너 결정 2026-07-28 "건드릴 때").
   * 판정은 각 화면이 한다. 사람이 손으로 펼친 구획은 접지 않는다.
   */
  readonly collapseWhenLeft?: boolean
  /**
   * 이 구획 안에서 사람이 무언가를 건드리면 부른다. 화면이 순서를 기록해
   * 앞 구획의 `collapseWhenLeft` 를 판정하는 데 쓴다.
   * 값이 바뀌는지가 아니라 **건드렸는지** 를 본다. 12 를 눌렀다가 다시
   * 눌러 취소해도 사람은 그 구획에 있었다.
   */
  readonly onTouch?: () => void
  /** 접혔을 때 한 줄로 보여줄 값. 사용자가 넣은 값만 쓴다. 판정 문구 금지. */
  readonly summary?: string
  /** 접힌 줄 오른쪽에 보일 안내. 예: "+ 추가" */
  readonly expandHint?: string
}) {
  // 처음 그릴 때 이미 답이 있으면 펼친 채로 시작한다. 답이 있는데 접혀
  // 있으면 사용자가 이미 넣은 값을 못 본다.
  const [open, setOpen] = React.useState(defaultOpen || autoOpenWhen === true)
  const previousAutoOpen = React.useRef(autoOpenWhen)
  const previousLeft = React.useRef(collapseWhenLeft)
  // 사람이 손으로 펼친 구획은 코드가 접지 않는다.
  const openedByHuman = React.useRef(false)
  // 자동 접기는 구획마다 딱 한 번이다. 고치는 중에 또 접히면 안 된다.
  const autoCollapsed = React.useRef(false)
  const contentId = React.useMemo(() => {
    formSecSeq += 1
    return `formsec-${formSecSeq}`
  }, [])

  React.useEffect(() => {
    if (autoOpenWhen === true && previousAutoOpen.current !== true) setOpen(true)
    previousAutoOpen.current = autoOpenWhen
  }, [autoOpenWhen])

  React.useEffect(() => {
    const justLeft = collapseWhenLeft === true && previousLeft.current !== true
    previousLeft.current = collapseWhenLeft
    if (!justLeft) return
    if (openedByHuman.current || autoCollapsed.current) return
    // 보여줄 값이 없으면 접지 않는다. 접힌 줄이 비어 있으면 무엇을
    // 넣었는지 알 수 없어서 어차피 다시 펼쳐야 한다.
    if (summary === undefined || summary === "") return
    autoCollapsed.current = true
    setOpen(false)
  }, [collapseWhenLeft, summary])

  const toggle = () => {
    setOpen((current) => {
      // 펼치는 조작이면 "사람이 열었다" 를 기억한다.
      if (!current) openedByHuman.current = true
      return !current
    })
  }

  // 구획 안을 건드린 것을 화면에 알린다. 누르기(마우스·손가락)와 초점
  // 이동(키보드) 둘 다 잡는다. capture 를 쓰는 이유는 안쪽 버튼이
  // 이벤트를 멈춰도 우리는 알아야 하기 때문이다.
  //
  // onTouch 를 안 준 구획은 감싸는 div 조차 만들지 않는다. FormSec 을 쓰는
  // 화면이 6개고 이번에 손대는 건 1개다. 안 쓰는 5개의 DOM 은 글자 하나도
  // 바뀌지 않아야 한다.
  const wrap = (inner: ReactNode) => onTouch === undefined ? inner : (
    <div onPointerDownCapture={onTouch} onFocusCapture={onTouch}>{inner}</div>
  )

  if (!collapsible) {
    return (
      <div style={{ padding: "18px 20px 0" }}>
        <div style={{ ...SECTION_LABEL_STYLE, marginBottom: 8 }}>
          {lb}{help && <TermHelp term={help} />}
        </div>
        {wrap(children)}
      </div>
    )
  }

  return (
    <div style={{ padding: "18px 20px 0" }}>
      <div
        className={open ? undefined : "formsec--collapsed"}
        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: open ? 8 : 0 }}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={toggle}
          style={{
            flex: 1, minHeight: 44, padding: "8px 0", border: 0, background: "transparent",
            cursor: "pointer", textAlign: "left", borderRadius: 0,
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <span style={SECTION_LABEL_STYLE}>{lb}</span>
          {!open && summary !== undefined && summary !== "" && (
            <span style={{
              fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--ink)",
              letterSpacing: "0.04em",
            }}>{summary}</span>
          )}
          <span aria-hidden="true" style={{
            marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)",
            letterSpacing: "0.06em",
          }}>{open ? "접기" : expandHint}</span>
        </button>
        {help && <TermHelp term={help} />}
      </div>
      <div id={contentId} style={open ? undefined : { display: "none" }}>
        {wrap(children)}
      </div>
    </div>
  )
}

export function TopBar({ onBack, children }: {
  readonly onBack?: () => void
  readonly children: ReactNode
}) {
  return (
    <div className="entry-topbar" style={{
      padding: "12px 16px", borderBottom: "1px solid var(--line)",
      display: "grid", gridTemplateColumns: "64px minmax(0, 1fr) 64px", alignItems: "center", flexShrink: 0,
    }}>
      <button type="button" onClick={onBack} style={{
        background: "transparent", border: 0, cursor: "pointer",
        minWidth: 64, minHeight: 44, padding: "4px 8px",
        fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)",
        letterSpacing: "0.06em",
      }}>← 뒤로</button>
      <h1 className="entry-topbar__title" style={{
        flex: 1, fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
        color: "var(--ink)", letterSpacing: "0.14em", textTransform: "uppercase",
        textAlign: "center", margin: 0,
      }}>{children}</h1>
      <div aria-hidden="true" style={{ width: 64 }}></div>
    </div>
  )
}
