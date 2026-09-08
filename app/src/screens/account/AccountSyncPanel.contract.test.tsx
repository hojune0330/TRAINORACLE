import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { saveSyncConsent } from "../../domain/account/sync"
import { AccountSyncPanel } from "./AccountSyncPanel"

afterEach(() => { cleanup(); vi.unstubAllEnvs() })
beforeEach(() => {
  window.localStorage.clear()
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "false")
  vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
})

describe("sync feature switch", () => {
  it.each([false, true])("replaces old sync with information when account journals are on (legacy enabled=%s)", enabled => {
    vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true")
    render(<AccountSyncPanel userId="athlete-a" enabled={enabled} />)
    expect(screen.getByRole("status")).toHaveTextContent("기기 원본은 그대로 보관돼요")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("blocks a stale merge callback after the account flag turns on without a rerender", async () => {
    const user = userEvent.setup()
    const onPreview = vi.fn().mockResolvedValue({ ok: true, message: "Ready", localCount: 1, remoteJournalCount: 0, remotePrivateCount: 0 })
    const onSync = vi.fn()
    render(<AccountSyncPanel userId="athlete-a" enabled onPreview={onPreview} onSync={onSync} />)
    await user.click(screen.getByRole("checkbox", { name: "동기화 켜기" }))
    await user.click(screen.getByRole("button", { name: "합칠 내용 미리보기" }))
    const merge = await screen.findByRole("button", { name: "확인한 내용 합치기" })
    vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true")
    await user.click(merge)
    expect(onSync).not.toHaveBeenCalled()
  })

  it("keeps local journals available when sync is switched off", () => {
    render(<AccountSyncPanel userId="athlete-a" enabled={false} />)

    expect(screen.getByText(/동기화만 잠시 닫혀 있어요/u)).toBeVisible()
    expect(screen.queryByRole("button", { name: "지금 동기화" })).not.toBeInTheDocument()
  })

  it("keeps the first public sync limited to structured journal fields", () => {
    render(<AccountSyncPanel userId="athlete-a" enabled sharingEnabled />)

    expect(screen.getByText(/훈련 메모와 나만의 메모 원문은 보내지 않아요/u)).toBeVisible()
    expect(screen.queryByRole("checkbox", { name: /메모/u })).not.toBeInTheDocument()
  })

  it("does not promise coach sharing while that feature is closed", () => {
    render(<AccountSyncPanel userId="athlete-a" enabled sharingEnabled={false} />)

    expect(screen.getByText(/코치 연결은 아직 열지 않았어요/u)).toBeVisible()
    expect(screen.queryByText(/코치에게 공유/u)).not.toBeInTheDocument()
  })

  it("reloads consent for the next account instead of carrying it across users", () => {
    saveSyncConsent({ enabled: true, shareTrainingNotes: true }, "athlete-a")
    const view = render(<AccountSyncPanel userId="athlete-a" enabled />)

    expect(screen.getByRole("checkbox", { name: "동기화 켜기" })).toBeChecked()

    view.rerender(<AccountSyncPanel userId="athlete-b" enabled />)

    expect(screen.getByRole("checkbox", { name: "동기화 켜기" })).not.toBeChecked()
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
    expect(await screen.findByText(/이 기기 3개 · 계정 일지 5개/u)).toBeVisible()
    expect(onSync).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "확인한 내용 합치기" }))
    expect(onSync).toHaveBeenCalledWith("athlete-a")
    expect(screen.getByRole("button", { name: "합칠 내용 미리보기" })).toBeVisible()
  })
})
