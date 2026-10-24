import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EraseLocalData } from "./EraseLocalData"
import { erasableKeys } from "../../domain/erase-local-data"

const disposal = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock("../../domain/account/goal-program-database-disposal", () => ({
  disposeGoalProgramDatabase: disposal.run,
}))

afterEach(cleanup)

describe("EraseLocalData recovery surface", () => {
  beforeEach(() => {
    disposal.run.mockReset()
    disposal.run.mockResolvedValue({ ok: true, failed: [] })
    window.localStorage.clear()
    window.localStorage.setItem("trainoracle.journal.v1", "[]")
  })

  it("offers a real backup action and explains the deletion scope before confirmation", () => {
    render(<EraseLocalData />)

    const backup = screen.getByRole("button", { name: /^일지 백업$/u })
    expect(backup).toBeVisible()
    expect(backup).toHaveAccessibleDescription(/메모 원문·목적을 제외한 JSON/u)
    expect(screen.getByText(/일지.*계획.*포인트.*로그인/u)).toBeVisible()
  })

  it("offers the restore route after local deletion", async () => {
    const user = userEvent.setup()
    const onOpenRestore = vi.fn()
    render(<EraseLocalData onOpenRestore={onOpenRestore} />)

    await user.click(screen.getByTestId("erase-start"))
    await user.click(screen.getByTestId("erase-confirm"))
    await screen.findByRole("button", { name: "백업 파일 되돌리기" })
    await user.click(screen.getByRole("button", { name: "백업 파일 되돌리기" }))

    expect(onOpenRestore).toHaveBeenCalledOnce()
    expect(disposal.run).toHaveBeenCalledOnce()
  })

  it("stays busy until database deletion resolves and reports partial deletion on database failure", async () => {
    const user = userEvent.setup()
    let resolveDisposal: ((result: { ok: boolean; failed: readonly string[] }) => void) | undefined
    disposal.run.mockImplementation(() => new Promise(resolve => { resolveDisposal = resolve }))
    render(<EraseLocalData />)

    await user.click(screen.getByTestId("erase-start"))
    await user.click(screen.getByTestId("erase-confirm"))

    expect(screen.getByTestId("erase-progress")).toBeVisible()
    expect(screen.getByTestId("erase-confirm")).toBeDisabled()
    expect(screen.getByTestId("erase-cancel")).toBeDisabled()
    expect(screen.queryByTestId("erase-result")).toBeNull()

    resolveDisposal?.({ ok: false, failed: ["trainoracle-account-goal-program-v1"] })
    const result = await screen.findByTestId("erase-result")
    expect(result.textContent).toContain("계정 훈련 계획 저장소를 삭제하지 못했어요")
    expect(result.textContent).not.toContain("저장 데이터를 삭제했어요")
  })
})

/**
 * Q3 — "이 기기 데이터 전부 지우기"는 실제로 **전부** 지우지 않는다.
 * 삭제 기록(tombstone)은 일부러 남긴다. 그러지 않으면 다시 로그인해
 * 동기화할 때 지운 일지가 서버에서 되살아난다.
 *
 * 남기는 것 자체는 옳다. 문제는 화면이 "모두 지워요"라고만 말해서
 * 사용자가 아무것도 남지 않는다고 믿게 되는 것이었다. 남는다는 사실을
 * 밝히는 것이 이 그룹의 계약이다.
 *
 * (지우는 선택지는 화면에 두지 않는다 — 사용자 결정. 고르는 순간 지운
 *  일지가 되살아나는 부작용이 생기므로, 알리기만 하고 주지 않는다.)
 */
describe("EraseLocalData — 무엇이 남는지 밝힌다 (Q3)", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("삭제 기록이 남는다는 사실을 확인 전에 알린다", () => {
    render(<EraseLocalData />)

    // 지우기를 누르기 **전에** 보여야 한다. 누른 뒤 알리면 늦다.
    const notice = screen.getByTestId("erase-deletion-record-notice")
    expect(notice).toBeVisible()
    expect(notice.textContent).toContain("남아요")
  })

  it("남는 것이 일지 내용이 아니라 '지웠다는 표시'임을 구분해 말한다", () => {
    render(<EraseLocalData />)

    const notice = screen.getByTestId("erase-deletion-record-notice").textContent ?? ""
    // 이 구분이 없으면 사용자는 일지 내용이 남는다고 오해한다.
    expect(notice).toContain("지웠는지")
    expect(notice).toContain("일지 내용이")
  })

  it("왜 남기는지 이유를 말한다 — 이유 없는 예외는 변명처럼 보인다", () => {
    render(<EraseLocalData />)

    const notice = screen.getByTestId("erase-deletion-record-notice").textContent ?? ""
    expect(notice).toContain("되살아나기")
  })

  it("실제로 삭제 기록 키가 지워지지 않는다 — 문구가 사실과 맞는지 확인", () => {
    // 화면 문구만 검사하면 "남는다고 써 놓고 실제로는 지우는" 반대 거짓말을
    // 잡지 못한다. 도메인이 정말 그 키를 빼는지 함께 고정한다.
    expect(erasableKeys()).not.toContain("trainoracle.sync.tombstones.v1")
  })
})
