import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GuardianConfirmationPanel } from "./GuardianConfirmationPanel"

afterEach(cleanup)

describe("guardian confirmation surface", () => {
  it("keeps child-code creation and guardian acceptance explicit", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue({
      ok: true,
      message: "보호자 확인 코드를 만들었어요.",
      code: "ABCD-EFGH-JKLM",
    })
    const onAccept = vi.fn().mockResolvedValue({ ok: true, message: "보호자 확인을 마쳤어요." })
    render(<GuardianConfirmationPanel userId="child-a" onCreate={onCreate} onAccept={onAccept} />)

    await user.click(screen.getByRole("button", { name: "보호자 확인 코드 만들기" }))
    expect(await screen.findByText("ABCD-EFGH-JKLM")).toBeVisible()

    await user.type(screen.getByLabelText("받은 보호자 확인 코드"), "ABCD-EFGH-JKLM")
    await user.click(screen.getByRole("button", { name: "보호자로 확인하기" }))
    expect(onAccept).toHaveBeenCalledWith("ABCD-EFGH-JKLM")
    expect(screen.getByText(/다른 사람의 계정으로 로그인/u)).toBeVisible()
  })
})
