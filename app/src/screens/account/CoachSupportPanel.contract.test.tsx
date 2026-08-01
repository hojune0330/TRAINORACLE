import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CoachSupportPanel } from "./CoachSupportPanel"

afterEach(cleanup)

describe("coach and supporter connection", () => {
  it("labels invitees as qualification unverified and creates a season invitation", async () => {
    const createInvitation = vi.fn().mockResolvedValue({
      ok: true,
      message: "초대 코드를 만들었어요.",
      code: "ABCD-EFGH-IJKL",
    })
    render(<CoachSupportPanel userId="athlete-a" today="2026-08-01" onCreateInvitation={createInvitation} />)

    expect(screen.getByText(/자격 미확인/u)).toBeVisible()
    await userEvent.type(screen.getByLabelText("시즌 종료일"), "2026-12-31")
    await userEvent.click(screen.getByRole("button", { name: "코치·지원자 초대 코드 만들기" }))

    expect(createInvitation).toHaveBeenCalledWith("athlete-a", "2026-12-31")
    expect(screen.getByText("ABCD-EFGH-IJKL")).toBeVisible()
  })

  it("accepts a code without asking for qualification claims", async () => {
    const acceptInvitation = vi.fn().mockResolvedValue({ ok: true, message: "연결했어요." })
    render(
      <CoachSupportPanel
        userId="supporter-a"
        today="2026-08-01"
        onCreateInvitation={vi.fn()}
        onAcceptInvitation={acceptInvitation}
      />,
    )

    await userEvent.type(screen.getByLabelText("받은 초대 코드"), "ABCD-EFGH-IJKL")
    await userEvent.click(screen.getByRole("button", { name: "초대 코드로 연결" }))
    expect(acceptInvitation).toHaveBeenCalledWith("ABCD-EFGH-IJKL")
  })
})
