/**
 * FormSec 접기 계약 — 작업지시서 UX1 §4-2 검산표를 그대로 옮긴 것.
 *
 * 이 파일이 지키는 것:
 * 1. `collapsible` 을 주지 않으면 예전과 같은 DOM 이다. FormSec 을 쓰는
 *    화면이 6개인데 이번에 손댄 건 2개다. 나머지 4개를 지키는 줄이다.
 * 2. 접혀도 children 이 DOM 에 남는다 = 입력값이 살아 있다.
 *    오너 지침 "지우거나 하라는 게 아니야" 가 화면에도 적용된다.
 * 3. 사람이 펼친 구획을 코드가 닫지 않는다.
 * 4. summary 에 판정 문구가 들어갈 수 없다 (사용자가 넣은 값만).
 */
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { FormSec } from "./shared"

afterEach(cleanup)

describe("FormSec 접기 — 기존 화면 보호", () => {
  it("compact only reduces whitespace and keeps the same controls", async () => {
    const user = userEvent.setup()
    const { container, rerender } = render(<FormSec lb="몸 상태"><input aria-label="값" defaultValue="유지" /></FormSec>)
    expect(container.firstElementChild).toHaveStyle({ padding: "18px 20px 0" })
    rerender(<FormSec compact lb="몸 상태" collapsible><input aria-label="값" defaultValue="유지" /></FormSec>)
    expect(container.firstElementChild).toHaveStyle({ padding: "4px 20px 0" })
    expect(screen.getByRole("button")).toHaveStyle({ minHeight: "44px" })
    await user.click(screen.getByRole("button"))
    await user.click(screen.getByRole("button"))
    expect(screen.getByLabelText("값")).toHaveValue("유지")
  })

  it("collapsible 을 주지 않으면 접기 버튼이 아예 없고 내용이 보인다", () => {
    render(
      <FormSec lb="긴장도 · 선택 사항">
        <input aria-label="긴장도 값" defaultValue="" />
      </FormSec>,
    )

    // 라벨은 버튼이 아니다 — RaceForm·RaceSelfChecks 가 이 동작에 기대고 있다.
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.getByLabelText("긴장도 값")).toBeVisible()
  })

  it("collapsible 이면서 defaultOpen 이면 펼쳐진 채로 시작한다", () => {
    render(
      <FormSec lb="객관 기록 · 0개" collapsible defaultOpen>
        <input aria-label="반복 횟수" defaultValue="" />
      </FormSec>,
    )

    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument()
    expect(screen.getByLabelText("반복 횟수")).toBeVisible()
  })
})

describe("FormSec 접기 — 닫힌 상태", () => {
  it("닫혀 있어도 children 이 DOM 에 남아 입력값이 살아 있다", async () => {
    const user = userEvent.setup()
    render(
      <FormSec lb="객관 기록 · 0개" collapsible defaultOpen={false} expandHint="+ 추가">
        <input aria-label="반복 횟수" defaultValue="" />
      </FormSec>,
    )

    // 닫힌 상태 — 눈에는 안 보이지만 DOM 에는 있다.
    const field = screen.getByLabelText("반복 횟수")
    expect(field).not.toBeVisible()
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument()

    // 펼쳐서 값을 넣고, 접었다가 다시 펼쳐도 값이 그대로다.
    await user.click(screen.getByRole("button", { expanded: false }))
    await user.type(screen.getByLabelText("반복 횟수"), "6")
    await user.click(screen.getByRole("button", { expanded: true }))
    await user.click(screen.getByRole("button", { expanded: false }))
    expect(screen.getByLabelText("반복 횟수")).toHaveValue("6")
  })

  it("접힌 줄에 summary 를 한 줄로 보여주고, 펼치면 감춘다", async () => {
    const user = userEvent.setup()
    render(
      <FormSec lb="RPE · 주관 강도" collapsible defaultOpen={false} summary="7/10">
        <div>내용</div>
      </FormSec>,
    )

    expect(screen.getByText("7/10")).toBeVisible()
    await user.click(screen.getByRole("button", { expanded: false }))
    expect(screen.queryByText("7/10")).not.toBeInTheDocument()
  })

  it("summary 가 없으면 값 칸을 비운다 — 없는 값을 지어내지 않는다", () => {
    render(
      <FormSec lb="객관 기록 · 0개" collapsible defaultOpen={false}>
        <div>내용</div>
      </FormSec>,
    )

    const toggle = screen.getByRole("button", { expanded: false })
    // 라벨과 안내 문구 외에 다른 값이 붙지 않는다. 0 을 채우지 않는다.
    expect(toggle.textContent).toBe("객관 기록 · 0개펼치기")
    expect(toggle.textContent).not.toMatch(/\b0\/|없음|미기록/u)
  })

  it("접힌 줄이 button 이라서 누른 느낌(:active)이 저절로 붙는다", () => {
    render(
      <FormSec lb="객관 기록 · 0개" collapsible defaultOpen={false}>
        <div>내용</div>
      </FormSec>,
    )

    // app.css 의 :active 규칙은 button 에만 붙는다. div onClick 이면 안 된다.
    const toggle = screen.getByRole("button", { expanded: false })
    expect(toggle.tagName).toBe("BUTTON")
    expect(toggle).toHaveAttribute("type", "button")
  })

  it("aria-controls 가 실제 내용 요소를 가리킨다", () => {
    render(
      <FormSec lb="객관 기록 · 0개" collapsible defaultOpen={false}>
        <div>내용</div>
      </FormSec>,
    )

    const toggle = screen.getByRole("button", { expanded: false })
    const contentId = toggle.getAttribute("aria-controls")
    expect(contentId).toBeTruthy()
    expect(document.getElementById(contentId ?? "")).toHaveTextContent("내용")
  })

  it("여러 개를 함께 그려도 aria-controls 가 서로 겹치지 않는다", () => {
    render(
      <>
        <FormSec lb="구획 하나" collapsible defaultOpen={false}><div>첫째</div></FormSec>
        <FormSec lb="구획 둘" collapsible defaultOpen={false}><div>둘째</div></FormSec>
      </>,
    )

    const toggles = screen.getAllByRole("button", { expanded: false })
    expect(toggles).toHaveLength(2)
    const ids = toggles.map((toggle) => toggle.getAttribute("aria-controls"))
    expect(new Set(ids).size).toBe(2)
  })
})

describe("FormSec 접기 — 사람이 한 조작을 코드가 되돌리지 않는다", () => {
  it("autoOpenWhen 이 true 로 바뀌면 펼친다", () => {
    const view = render(
      <FormSec lb="객관 기록 · 0개" collapsible defaultOpen={false} autoOpenWhen={false}>
        <div>내용</div>
      </FormSec>,
    )
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument()

    view.rerender(
      <FormSec lb="객관 기록 · 1개" collapsible defaultOpen={false} autoOpenWhen={true}>
        <div>내용</div>
      </FormSec>,
    )
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument()
  })

  it("autoOpenWhen 이 다시 false 가 되어도 코드가 닫지 않는다", () => {
    const view = render(
      <FormSec lb="객관 기록 · 1개" collapsible defaultOpen={false} autoOpenWhen={true}>
        <div>내용</div>
      </FormSec>,
    )
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument()

    // 항목을 다 지워도 펼쳐진 상태를 유지한다.
    // 사람이 보고 있는 화면을 코드가 접으면 조작을 빼앗긴 느낌이 된다.
    view.rerender(
      <FormSec lb="객관 기록 · 0개" collapsible defaultOpen={false} autoOpenWhen={false}>
        <div>내용</div>
      </FormSec>,
    )
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument()
  })

  it("사람이 손으로 접은 뒤에는 같은 조건이 다시 와도 저절로 펼치지 않는다", async () => {
    const user = userEvent.setup()
    const view = render(
      <FormSec lb="객관 기록 · 1개" collapsible defaultOpen={false} autoOpenWhen={true}>
        <div>내용</div>
      </FormSec>,
    )

    await user.click(screen.getByRole("button", { expanded: true }))
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument()

    // autoOpenWhen 이 계속 true 로 다시 그려져도 접힌 상태가 유지된다.
    view.rerender(
      <FormSec lb="객관 기록 · 2개" collapsible defaultOpen={false} autoOpenWhen={true}>
        <div>내용</div>
      </FormSec>,
    )
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument()
  })
})

describe("FormSec 자동 접기 — 오너 결정 \"건드릴 때\"", () => {
  const Sec = (props: { readonly left: boolean; readonly summary?: string }) => (
    <FormSec
      lb="RPE · 주관 강도"
      collapsible
      collapseWhenLeft={props.left}
      summary={props.summary}
    >
      <input aria-label="RPE 값" defaultValue="" />
    </FormSec>
  )

  it("다음 구획을 건드리는 순간 접힌다", () => {
    const view = render(<Sec left={false} summary="7/10" />)
    // 답을 넣은 것만으로는 접히지 않는다. 방금 누른 값을 확인할 시간을 준다.
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument()

    view.rerender(<Sec left={true} summary="7/10" />)
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument()
    // 접혀도 값은 살아 있다.
    expect(screen.getByLabelText("RPE 값")).toBeInTheDocument()
    expect(screen.getByText("7/10")).toBeVisible()
  })

  it("보여줄 값이 없으면 접지 않는다", () => {
    const view = render(<Sec left={false} />)
    view.rerender(<Sec left={true} />)
    // 접힌 줄이 비면 무엇을 넣었는지 알 수 없어 어차피 다시 펼쳐야 한다.
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument()
  })

  it("사람이 손으로 펼친 구획은 접지 않는다", async () => {
    const user = userEvent.setup()
    const view = render(
      <FormSec lb="RPE" collapsible defaultOpen={false} collapseWhenLeft={false} summary="7/10">
        <div>내용</div>
      </FormSec>,
    )

    await user.click(screen.getByRole("button", { expanded: false }))
    view.rerender(
      <FormSec lb="RPE" collapsible defaultOpen={false} collapseWhenLeft={true} summary="7/10">
        <div>내용</div>
      </FormSec>,
    )
    // 사람이 연 것을 코드가 닫으면 조작을 빼앗긴 느낌이 된다.
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument()
  })

  it("한 번 접은 뒤 사람이 다시 펼치면 또 접지 않는다", async () => {
    const user = userEvent.setup()
    const view = render(<Sec left={false} summary="7/10" />)
    view.rerender(<Sec left={true} summary="7/10" />)
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument()

    // 고치려고 다시 펼친다.
    await user.click(screen.getByRole("button", { expanded: false }))
    // 값이 바뀌어 다시 그려져도 접히지 않는다. 고치는 중에 접히면 안 된다.
    view.rerender(<Sec left={true} summary="8/10" />)
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument()
  })

  it("collapseWhenLeft 를 주지 않은 구획은 접히지 않는다", () => {
    const view = render(
      <FormSec lb="객관 기록 · 0개" collapsible summary="1개"><div>내용</div></FormSec>,
    )
    view.rerender(
      <FormSec lb="객관 기록 · 1개" collapsible summary="1개"><div>내용</div></FormSec>,
    )
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument()
  })
})

describe("FormSec onTouch — 건드린 것을 알린다", () => {
  it("내용 안을 누르면 알리고, 접기 단추를 누르는 건 알리지 않는다", async () => {
    const user = userEvent.setup()
    const touched: number[] = []
    render(
      <FormSec lb="RPE" collapsible onTouch={() => touched.push(1)}>
        <button type="button">7</button>
      </FormSec>,
    )

    await user.click(screen.getByRole("button", { name: "7" }))
    expect(touched.length).toBeGreaterThan(0)

    // 접기 단추는 구획 "안" 이 아니다. 접었다고 앞 구획이 끝난 건 아니다.
    const before = touched.length
    await user.click(screen.getByRole("button", { expanded: true }))
    expect(touched.length).toBe(before)
  })

  it("onTouch 를 주지 않으면 감싸는 div 도 만들지 않는다", () => {
    const { container } = render(
      <FormSec lb="긴장도"><input aria-label="긴장도 값" defaultValue="" /></FormSec>,
    )
    // FormSec 을 쓰는 화면 6개 중 손대지 않은 것들의 DOM 이 그대로여야 한다.
    const outer = container.firstElementChild
    expect(outer?.children).toHaveLength(2)
    expect(outer?.children[1]?.tagName).toBe("INPUT")
  })
})

describe("FormSec 접기 — 판정 문구 금지", () => {
  it("접힌 줄에 판정·평가 낱말이 나오지 않는다", () => {
    // summary 는 사용자가 넣은 값만 담는다. 화면이 사람을 평가하지 않는다.
    render(
      <FormSec lb="RPE · 주관 강도" collapsible defaultOpen={false} summary="7/10">
        <div>내용</div>
      </FormSec>,
    )

    const toggle = screen.getByRole("button", { expanded: false })
    expect(toggle.textContent).not.toMatch(/높음|낮음|좋음|나쁨|양호|준비도|위험|과훈련/u)
  })
})
