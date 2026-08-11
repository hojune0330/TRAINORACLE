import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AccountSyncPanel } from "./AccountSyncPanel"

afterEach(cleanup)
beforeEach(() => window.localStorage.clear())

describe("sync feature switch", () => {
  it("keeps local journals available when sync is switched off", () => {
    render(<AccountSyncPanel userId="athlete-a" enabled={false} />)

    expect(screen.getByText(/동기화만 잠시 닫혀 있어요/u)).toBeVisible()
    expect(screen.queryByRole("button", { name: "지금 동기화" })).not.toBeInTheDocument()
  })

  it("shows purpose-aware controls when sync is open", () => {
    render(<AccountSyncPanel userId="athlete-a" enabled sharingEnabled />)

    expect(screen.getByText(/훈련 메모를 계정과 코치에게 공유/u)).toBeVisible()
    expect(screen.getByText(/나만의 메모는 이 설정과 관계없이/u)).toBeVisible()
  })

  it("does not promise coach sharing while that feature is closed", () => {
    render(<AccountSyncPanel userId="athlete-a" enabled sharingEnabled={false} />)

    expect(screen.getByText(/훈련 메모를 계정에 백업/u)).toBeVisible()
    expect(screen.queryByText(/코치에게 공유/u)).not.toBeInTheDocument()
  })

  it("shows a server preview before it allows the merge", async () => {
    const user = userEvent.setup()
    const onPreview = vi.fn().mockResolvedValue({
      ok: true,
      message: "미리보기를 준비했어요.",
      localCount: 3,
      remoteJournalCount: 5,
      remotePrivateCount: 2,
    })
    const onSync = vi.fn().mockResolvedValue({
      ok: true,
      message: "동기화가 끝났어요.",
      pulled: 5,
      pushed: 3,
      deleted: 0,
      total: 8,
    })
    render(<AccountSyncPanel userId="athlete-a" enabled onPreview={onPreview} onSync={onSync} />)

    await user.click(screen.getByRole("checkbox", { name: "동기화 켜기" }))
    expect(screen.queryByRole("button", { name: /합치기/u })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "합칠 내용 미리보기" }))
    expect(await screen.findByText(/이 기기 3개 · 계정 일지 5개 · 암호화된 나만의 메모 2개/u)).toBeVisible()
    expect(onSync).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "확인한 내용 합치기" }))
    expect(onSync).toHaveBeenCalledWith("athlete-a")
  })
})
