/**
 * 자동 접기 — 실제 화면(PostSessionForm)에서의 계약.
 *
 * FormSec.contract.test.tsx 는 부품을 시험한다. 이 파일은 **배선** 을 시험한다.
 * 부품이 맞아도 배선이 틀리면 사용자는 틀린 것을 본다.
 *
 * 오너 결정 2026-07-28: 접는 시점은 "건드릴 때" 다.
 * 그래서 이 파일이 지키는 것은 두 가지고, 둘째가 더 중요하다.
 *
 * 1. 다음 구획을 건드리면 앞 구획이 접힌다.
 * 2. **답을 넣는 순간에는 절대 접히지 않는다.** 순서가 어떻든.
 *    예상 강도를 먼저 채운 사람이 RPE 를 누르는 경우가 함정이다.
 *    "값" 으로 판정하면 이때 RPE 를 누른 즉시 RPE 가 접힌다 — 자기가 7 을
 *    눌렀는지 8 을 눌렀는지 확인할 수 없다. 오너가 물리친 동작이다
 *    (작업지시서 UX1 D3). 실제 e2e 하나가 정확히 그 순서로 누른다
 *    (e2e/intensity-assessment.spec.ts:16-17).
 */
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { PostSessionForm } from "./PostSessionForm"

afterEach(cleanup)

const rpeToggle = () => screen.getByRole("button", { name: /RPE · 주관 강도/u })
// getByRole 에는 exact 옵션이 없다 (있는 줄 알고 썼다가 tsc 가 잡았다).
// 이름이 정확히 그 숫자인 것만 잡으려면 앵커 붙은 정규식을 써야 한다.
// 안 그러면 "7" 이 "예상 강도 7" 과 "17" 에도 걸린다.
const exactName = (value: number) => new RegExp(`^${value}$`, "u")
const rpeButton = (value: number) => screen.getByRole("button", { name: exactName(value) })
/**
 * 접힌 구획 안의 버튼. `hidden: true` 가 필요한 이유:
 * getByRole 은 display:none 을 못 본다. 접기를 display:none 으로 한 것은
 * 값을 살리기 위한 결정이고(지우면 입력이 사라진다), 그 대가로 접힌 동안은
 * 역할로 찾을 수 없다. 스크린리더도 못 읽는다 — 그래서 접힌 줄에 summary 로
 * 값을 남기는 것이 필수다.
 */
const hiddenRpeButton = (value: number) => screen.getByRole("button", { name: exactName(value), hidden: true })

describe("훈련 후 일지 자동 접기", () => {
  it("RPE 를 고른 직후에는 접히지 않는다 — 누른 값을 확인할 시간을 준다", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm />)

    await user.click(rpeButton(7))

    expect(rpeToggle()).toHaveAttribute("aria-expanded", "true")
    expect(rpeButton(7)).toHaveAttribute("aria-pressed", "true")
  })

  it("다음 구획(예상 강도)을 건드리면 RPE 가 접히고 값이 한 줄로 남는다", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm />)

    await user.click(rpeButton(7))
    await user.click(screen.getByRole("button", { name: "예상 강도 8" }))

    expect(rpeToggle()).toHaveAttribute("aria-expanded", "false")
    // 접힌 줄 안에 값이 한 줄로 남는다. 화면 다른 곳에도 7/10 이 나오므로
    // 접힌 줄 자체를 본다.
    expect(rpeToggle().textContent).toContain("7/10")
    // 접혀도 값은 살아 있다. 접기는 보기 방식일 뿐이다.
    expect(hiddenRpeButton(7)).toHaveAttribute("aria-pressed", "true")
  })

  it("예상 강도를 먼저 채운 뒤 RPE 를 눌러도 RPE 는 펼쳐진 채다", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm />)

    // 이 순서가 함정이다. 값으로 판정하면 여기서 접힌다.
    await user.click(screen.getByRole("button", { name: "예상 강도 7" }))
    await user.click(rpeButton(8))

    expect(rpeToggle()).toHaveAttribute("aria-expanded", "true")
    expect(rpeButton(8)).toHaveAttribute("aria-pressed", "true")
  })

  it("RPE 를 안 고르고 다음으로 넘어가면 접지 않는다", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm />)

    await user.click(screen.getByRole("button", { name: "예상 강도 7" }))

    // 보여줄 값이 없으면 접힌 줄이 비어서 어차피 다시 펼쳐야 한다.
    expect(rpeToggle()).toHaveAttribute("aria-expanded", "true")
  })

  it("접힌 RPE 를 다시 펼쳐 고칠 수 있고, 고치는 중에 다시 접히지 않는다", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm />)

    await user.click(rpeButton(7))
    await user.click(screen.getByRole("button", { name: "예상 강도 8" }))
    expect(rpeToggle()).toHaveAttribute("aria-expanded", "false")

    await user.click(rpeToggle())
    await user.click(rpeButton(9))
    await user.click(screen.getByRole("button", { name: "예상 강도 6" }))

    expect(rpeToggle()).toHaveAttribute("aria-expanded", "true")
    expect(rpeButton(9)).toHaveAttribute("aria-pressed", "true")
  })

  it("접힌 상태로 저장해도 RPE 가 그대로 저장된다", async () => {
    const user = userEvent.setup()
    window.localStorage.clear()
    render(<PostSessionForm />)

    await user.click(rpeButton(7))
    await user.click(screen.getByRole("button", { name: "예상 강도 8" }))
    expect(rpeToggle()).toHaveAttribute("aria-expanded", "false")
    await user.click(screen.getByRole("button", { name: /^저장/u }))

    const saved = window.localStorage.getItem("trainoracle.journal.v1")
    expect(saved).toContain('"rpe":7')
    expect(saved).toContain('"plannedRpe":8')
    // 접혔다고 출처가 MISSING 으로 떨어지면 안 된다.
    expect(saved).toContain('"rpe":{"provenance":"EXPLICIT"}')
    expect(saved).not.toContain('"rpe":{"provenance":"MISSING"}')
  })

  it("접힌 줄에 판정 문구가 없다", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm />)

    await user.click(rpeButton(9))
    await user.click(screen.getByRole("button", { name: "예상 강도 8" }))

    expect(rpeToggle().textContent).not.toMatch(/높음|낮음|좋음|나쁨|양호|무리|과훈련|위험/u)
  })
})
