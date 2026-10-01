import React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LoungeEntry } from "./LoungeEntry"
import type { AccountUser } from "../../domain/account/auth"
import { registerUnsavedDraftGuard } from "../../domain/unsaved-draft-navigation"

const mocks = vi.hoisted(() => ({ config: vi.fn(), session: vi.fn(), rpc: vi.fn(), abort: vi.fn(), intent: vi.fn(), clear: vi.fn(), auth: vi.fn() }))
vi.mock("../../domain/lounge/config", async original => ({ ...await original<typeof import("../../domain/lounge/config")>(), loungeConfig: mocks.config }))
vi.mock("../../domain/lounge/entry-intent", () => ({ loungeEntryIntent: mocks.intent, clearPendingLoungeLink: mocks.clear }))
vi.mock("../../domain/account/supabase-client", () => ({ supabase: async () => ({ auth: { getSession: mocks.session }, rpc: (name: string) => ({ abortSignal: (signal: AbortSignal) => { mocks.abort(signal); return mocks.rpc(name) } }) }) }))
vi.mock("../../domain/account/auth", () => ({ onAuthChange: mocks.auth }))

const ready = { version: 1, noticeVersion: "lounge-v1-2026-09-30", roomId: "synthetic-room", trainoracleEntryEnabled: true, readiness: { writesReady: true, reason: null } }
const reply = (value: unknown) => new Response(JSON.stringify(value), { status: 200 })
const user = (id: string): AccountUser => ({ id, email: null, phone: null, provider: null })
let listener: (next: AccountUser | null) => void
let fetchMock: ReturnType<typeof vi.fn>
let owner: string

beforeEach(() => {
  vi.clearAllMocks()
  owner = "synthetic-A"
  mocks.config.mockReturnValue({ realtimeUrl: "https://runtime.example/", pageUrl: "https://lounge.example/lounge" })
  mocks.intent.mockReturnValue({ requested: true, linkRequested: false, linkToken: null })
  mocks.auth.mockImplementation(callback => { listener = callback; return vi.fn() })
  mocks.session.mockImplementation(async () => ({ data: { session: { user: { id: owner }, access_token: "synthetic-credential" } }, error: null }))
  mocks.rpc.mockImplementation(async () => ({ data: { version: 1, grant: "lg1_" + "a".repeat(64), expiresAt: new Date(Date.now() + 60_000).toISOString() }, error: null }))
  fetchMock = vi.fn(async (url: URL) => reply(url.pathname === "/api/lounge/status" ? ready : { ticket: "t".repeat(43) }))
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function acceptEntry() {
  await userEvent.click(await screen.findByRole("checkbox", { name: /닉네임이 보이는 공개 대화/u }))
  await userEvent.click(screen.getByRole("button", { name: "확인하고 라운지 열기" }))
}

describe("existing-account lounge entry", () => {
  it("hides entry and does not make a request when the release flag is off", () => {
    mocks.config.mockReturnValue(null)
    render(<LoungeEntry userId={owner} requested />)
    expect(screen.queryByRole("heading", { name: "함께 이야기하는 라운지" })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("keeps settings entry optional and fetches only after explicit opening", async () => {
    render(<LoungeEntry userId={owner} />)
    expect(fetchMock).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "라운지 입장 안내" }))
    expect(await screen.findByRole("button", { name: "확인하고 라운지 열기" })).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it("explains persistent nickname and does not enter until notice confirmation", async () => {
    const onNavigate = vi.fn()
    render(<LoungeEntry userId={owner} requested onNavigate={onNavigate} />)
    expect(await screen.findByRole("button", { name: "확인하고 라운지 열기" })).toBeDisabled()
    expect(screen.getByText(/익명 게시판이 아니며/u)).toBeVisible()
    const summary = screen.getByText("계정 연결·정보 보관 안내").closest("summary")
    expect(summary).not.toBeNull()
    expect(summary?.closest("details")).not.toHaveAttribute("open")
    expect(screen.getByText(/이미 다른 프로필에 연결돼 있다면 자동으로 합치지 않아요/u)).not.toBeVisible()
    expect(screen.getByText(/다음으로 성공한 일별 정리/u)).not.toBeVisible()
    await userEvent.tab()
    expect(summary).toHaveFocus()
    await userEvent.click(summary!)
    expect(summary?.closest("details")).toHaveAttribute("open")
    expect(screen.getByText(/이미 다른 프로필에 연결돼 있다면 자동으로 합치지 않아요/u)).toBeVisible()
    expect(screen.getByText(/다음으로 성공한 일별 정리/u)).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await acceptEntry()
    await waitFor(() => expect(onNavigate).toHaveBeenCalledTimes(1))
    expect(new URL(onNavigate.mock.calls[0]?.[0]).search).toBe("")
    expect(fetchMock.mock.calls[1]?.[1].body).toBe(JSON.stringify({ noticeVersion: ready.noticeVersion }))
    expect(fetchMock.mock.calls[1]?.[1].headers.Authorization).toBe("Bearer lg1_" + "a".repeat(64))
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("synthetic-credential")
    expect(mocks.rpc).toHaveBeenCalledWith("issue_lounge_grant")
  })
  it("hides impossible entry actions when the runtime is not prepared", async () => {
    fetchMock.mockResolvedValue(reply({ ...ready, readiness: { writesReady: false, reason: "RETENTION_BUSY" } }))
    render(<LoungeEntry userId={owner} requested />)
    expect(await screen.findByText(/라운지를 준비 중/u)).toBeVisible()
    expect(screen.queryByRole("button", { name: "확인하고 라운지 열기" })).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })
  it.each([false, undefined])("keeps TrainOracle entry closed when issuer enablement is %s", async trainoracleEntryEnabled => {
    fetchMock.mockResolvedValue(reply({ ...ready, trainoracleEntryEnabled }))
    render(<LoungeEntry userId={owner} requested />)
    expect(await screen.findByText(/라운지를 준비 중/u)).toBeVisible()
    expect(screen.queryByRole("button", { name: "확인하고 라운지 열기" })).not.toBeInTheDocument()
  })
  it("keeps malformed status a failure and offers a status-only retry", async () => {
    fetchMock.mockResolvedValueOnce(reply({ ...ready, version: 99 }))
    render(<LoungeEntry userId={owner} requested />)
    expect(await screen.findByText(/라운지 상태를 확인하지 못했어요/u)).toBeVisible()
    expect(screen.queryByRole("button", { name: "확인하고 라운지 열기" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "상태 다시 확인" }))
    expect(await screen.findByRole("button", { name: "확인하고 라운지 열기" })).toBeDisabled()
    expect(fetchMock.mock.calls.every(call => call[1].method === "GET")).toBe(true)
  })
  it("requires separate explicit linking, then a new entry confirmation without auto-navigation", async () => {
    const token = "l".repeat(43)
    mocks.intent.mockReturnValue({ requested: true, linkRequested: true, linkToken: token })
    fetchMock.mockImplementation(async (url: URL) => reply(url.pathname === "/api/lounge/status" ? ready : { linked: true }))
    const onNavigate = vi.fn()
    const view = render(<React.StrictMode><LoungeEntry userId={owner} requested onNavigate={onNavigate} /></React.StrictMode>)
    expect(await screen.findByRole("button", { name: "확인하고 계정 연결" })).toBeDisabled()
    expect(view.container.textContent).not.toContain(token)
    await userEvent.click(screen.getByRole("checkbox", { name: /현재 로그인한 TrainOracle 계정을/u }))
    await userEvent.click(screen.getByRole("button", { name: "확인하고 계정 연결" }))
    expect(await screen.findByText(/계정 연결을 마쳤어요/u)).toBeVisible()
    expect(await screen.findByRole("button", { name: "확인하고 라운지 열기" })).toBeDisabled()
    const post = fetchMock.mock.calls.find(call => call[1].method === "POST")
    expect(post?.[1].body).toBe(JSON.stringify({ token }))
    expect(onNavigate).not.toHaveBeenCalled()
  })
  it("explains link restart after OAuth instead of reading a stored token", async () => {
    mocks.intent.mockReturnValue({ requested: true, linkRequested: true, linkToken: null })
    render(<LoungeEntry userId={owner} requested />)
    expect(await screen.findByText(/‘계정 연결’에서 다시 시작/u)).toBeVisible()
    expect(screen.queryByRole("button", { name: "확인하고 계정 연결" })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.every(call => call[1].method === "GET")).toBe(true)
  })
  it("skips the first participation notice only after a fresh server read and opens with resume", async () => {
    fetchMock.mockImplementation(async (url: URL) => reply(url.pathname === "/api/lounge/status" ? { ...ready, trainoracleParticipationVersion: 1 }
      : url.pathname === "/api/lounge/participation/trainoracle" ? { version: 1, noticeVersion: ready.noticeVersion, accepted: true } : { ticket: "t".repeat(43) }))
    const onNavigate = vi.fn()
    render(<LoungeEntry userId={owner} requested onNavigate={onNavigate} />)
    expect(await screen.findByRole("button", { name: "라운지 열기" })).toBeEnabled()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.getByText("기존 라운지 닉네임으로 다시 참여해요.")).toBeVisible()
    expect(onNavigate).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "라운지 열기" }))
    await waitFor(() => expect(onNavigate).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[2]?.[1].body).toBe(JSON.stringify({ noticeVersion: ready.noticeVersion, resume: true }))
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
  it("keeps first participation explicit when the server confirms no current notice", async () => {
    fetchMock.mockImplementation(async (url: URL) => reply(url.pathname === "/api/lounge/status" ? { ...ready, trainoracleParticipationVersion: 1 }
      : url.pathname === "/api/lounge/participation/trainoracle" ? { version: 1, noticeVersion: ready.noticeVersion, accepted: false } : { ticket: "t".repeat(43) }))
    const onNavigate = vi.fn()
    render(<LoungeEntry userId={owner} requested onNavigate={onNavigate} />)
    expect(await screen.findByRole("button", { name: "확인하고 라운지 열기" })).toBeDisabled()
    expect(onNavigate).not.toHaveBeenCalled()
    await acceptEntry()
    await waitFor(() => expect(onNavigate).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[2]?.[1].body).toBe(JSON.stringify({ noticeVersion: ready.noticeVersion }))
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
  it("refreshes server acceptance after explicit linking without pretending linking was notice consent", async () => {
    mocks.intent.mockReturnValue({ requested: true, linkRequested: true, linkToken: "l".repeat(43) })
    let linked = false
    fetchMock.mockImplementation(async (url: URL) => {
      if (url.pathname === "/api/lounge/status") return reply({ ...ready, trainoracleParticipationVersion: 1 })
      if (url.pathname === "/api/lounge/participation/trainoracle") return reply({ version: 1, noticeVersion: ready.noticeVersion, accepted: linked })
      linked = true
      return reply({ linked: true })
    })
    const onNavigate = vi.fn()
    render(<LoungeEntry userId={owner} requested onNavigate={onNavigate} />)
    await userEvent.click(await screen.findByRole("checkbox", { name: /현재 로그인한 TrainOracle 계정을/u }))
    await userEvent.click(screen.getByRole("button", { name: "확인하고 계정 연결" }))
    expect(await screen.findByRole("button", { name: "라운지 열기" })).toBeEnabled()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(call => call[0].pathname === "/api/lounge/participation/trainoracle")).toHaveLength(2)
    expect(onNavigate).not.toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
  it("refreshes a deleted participation or changed notice before asking for explicit consent again", async () => {
    let accepted = true
    fetchMock.mockImplementation(async (url: URL) => {
      if (url.pathname === "/api/lounge/status") return reply({ ...ready, trainoracleParticipationVersion: 1 })
      if (url.pathname === "/api/lounge/participation/trainoracle") return reply({ version: 1, noticeVersion: ready.noticeVersion, accepted })
      accepted = false
      return new Response(JSON.stringify({ code: "NOTICE_REQUIRED" }), { status: 409 })
    })
    const onNavigate = vi.fn()
    render(<LoungeEntry userId={owner} requested onNavigate={onNavigate} />)
    await userEvent.click(await screen.findByRole("button", { name: "라운지 열기" }))
    expect(await screen.findByRole("checkbox", { name: /닉네임이 보이는 공개 대화/u })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "확인하고 라운지 열기" })).toBeDisabled()
    expect(screen.getByText(/현재 안내를 다시 확인/u)).toBeVisible()
    expect(onNavigate).not.toHaveBeenCalled()
  })
  it("discards a late authenticated acceptance after account switching", async () => {
    let resolveParticipation!: (value: Response) => void
    const pending = new Promise<Response>(resolve => { resolveParticipation = resolve })
    fetchMock.mockImplementation(async (url: URL) => url.pathname === "/api/lounge/status" ? reply({ ...ready, trainoracleParticipationVersion: 1 }) : pending)
    render(<LoungeEntry userId={owner} requested />)
    await waitFor(() => expect(fetchMock.mock.calls.some(call => call[0].pathname === "/api/lounge/participation/trainoracle")).toBe(true))
    act(() => { owner = "synthetic-B"; listener(user(owner)); owner = "synthetic-A"; listener(user(owner)) })
    await act(async () => { resolveParticipation(reply({ version: 1, noticeVersion: ready.noticeVersion, accepted: true })); await pending })
    expect(screen.queryByRole("button", { name: "라운지 열기" })).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.getByText(/로그인 계정이 바뀌었어요/u)).toBeVisible()
  })
  it("resets an unsubmitted notice choice when the rendered account changes", async () => {
    const view = render(<LoungeEntry userId={owner} requested />)
    await userEvent.click(await screen.findByRole("checkbox", { name: /닉네임이 보이는 공개 대화/u }))
    expect(screen.getByRole("button", { name: "확인하고 라운지 열기" })).toBeEnabled()
    owner = "synthetic-B"
    view.rerender(<LoungeEntry userId={owner} requested />)
    expect(await screen.findByRole("checkbox", { name: /닉네임이 보이는 공개 대화/u })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "확인하고 라운지 열기" })).toBeDisabled()
  })
  it("keeps unsubmitted link and confirmation when the same account refreshes", async () => {
    mocks.intent.mockReturnValue({ requested: true, linkRequested: true, linkToken: "l".repeat(43) })
    render(<LoungeEntry userId={owner} requested />)
    await userEvent.click(await screen.findByRole("checkbox", { name: /현재 로그인한 TrainOracle 계정을/u }))
    act(() => listener(user(owner)))
    expect(screen.getByRole("checkbox", { name: /현재 로그인한 TrainOracle 계정을/u })).toBeChecked()
    expect(screen.getByRole("button", { name: "확인하고 계정 연결" })).toBeEnabled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it("aborts an in-flight A request and never navigates after A→B→A", async () => {
    let resolvePost!: (value: Response) => void
    const pending = new Promise<Response>(resolve => { resolvePost = resolve })
    fetchMock.mockImplementation(async (url: URL) => url.pathname === "/api/lounge/status" ? reply(ready) : pending)
    const onNavigate = vi.fn()
    render(<LoungeEntry userId={owner} requested onNavigate={onNavigate} />)
    await acceptEntry()
    await waitFor(() => expect(fetchMock.mock.calls.some(call => call[1].method === "POST")).toBe(true))
    const post = fetchMock.mock.calls.find(call => call[1].method === "POST")
    act(() => { owner = "synthetic-B"; listener(user(owner)); owner = "synthetic-A"; listener(user(owner)) })
    expect(post?.[1].signal.aborted).toBe(true)
    await act(async () => { resolvePost(reply({ ticket: "t".repeat(43) })); await pending })
    expect(onNavigate).not.toHaveBeenCalled()
    expect(screen.getByText(/로그인 계정이 바뀌었어요/u)).toBeVisible()
    expect(screen.queryByRole("button", { name: "확인하고 라운지 열기" })).not.toBeInTheDocument()
  })
  it("cancels a late session read before POST when logging out", async () => {
    let resolveSession!: (value: unknown) => void
    const pending = new Promise(resolve => { resolveSession = resolve })
    mocks.session.mockReturnValueOnce(pending)
    const onNavigate = vi.fn()
    render(<LoungeEntry userId={owner} requested onNavigate={onNavigate} />)
    await acceptEntry()
    act(() => listener(null))
    await act(async () => { resolveSession({ data: { session: { user: { id: owner }, access_token: "synthetic-credential" } }, error: null }); await pending })
    expect(fetchMock.mock.calls.every(call => call[1].method === "GET")).toBe(true)
    expect(onNavigate).not.toHaveBeenCalled()
  })
  it("discards a late grant RPC after A→B→A without transmitting it to the lounge", async () => {
    let resolveGrant!: (value: unknown) => void
    const pending = new Promise(resolve => { resolveGrant = resolve })
    mocks.rpc.mockReturnValueOnce(pending)
    const onNavigate = vi.fn()
    render(<LoungeEntry userId={owner} requested onNavigate={onNavigate} />)
    await acceptEntry()
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1))
    act(() => { owner = "synthetic-B"; listener(user(owner)); owner = "synthetic-A"; listener(user(owner)) })
    expect(mocks.abort.mock.calls.at(-1)?.[0].aborted).toBe(true)
    await act(async () => {
      resolveGrant({ data: { version: 1, grant: "lg1_" + "a".repeat(64), expiresAt: new Date(Date.now() + 60_000).toISOString() }, error: null })
      await pending
    })
    expect(fetchMock.mock.calls.every(call => call[1].method === "GET")).toBe(true)
    expect(onNavigate).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "확인하고 라운지 열기" })).not.toBeInTheDocument()
  })
  it("aborts an unmounted request even when a fetch adapter delivers a late success", async () => {
    let resolvePost!: (value: Response) => void
    const pending = new Promise<Response>(resolve => { resolvePost = resolve })
    fetchMock.mockImplementation(async (url: URL) => url.pathname === "/api/lounge/status" ? reply(ready) : pending)
    const onNavigate = vi.fn()
    const view = render(<LoungeEntry userId={owner} requested onNavigate={onNavigate} />)
    await acceptEntry()
    await waitFor(() => expect(fetchMock.mock.calls.some(call => call[1].method === "POST")).toBe(true))
    const post = fetchMock.mock.calls.find(call => call[1].method === "POST")
    view.unmount()
    expect(post?.[1].signal.aborted).toBe(true)
    await act(async () => { resolvePost(reply({ ticket: "t".repeat(43) })); await pending })
    expect(onNavigate).not.toHaveBeenCalled()
  })
  it.each(["link", "failed-post", "navigate"] as const)("discards a volatile draft only for actual navigation, not %s", async kind => {
    const confirmDiscard = vi.fn(() => true)
    const discard = vi.fn()
    const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, confirmDiscard, discard, onBlocked: vi.fn() })
    try {
      if (kind === "link") mocks.intent.mockReturnValue({ requested: true, linkRequested: true, linkToken: "l".repeat(43) })
      fetchMock.mockImplementation(async (url: URL) => {
        if (url.pathname === "/api/lounge/status") return reply(ready)
        if (kind === "failed-post") return new Response("{}", { status: 503 })
        return reply(kind === "link" ? { linked: true } : { ticket: "t".repeat(43) })
      })
      const onNavigate = vi.fn()
      render(<LoungeEntry userId={owner} requested onNavigate={onNavigate} />)
      if (kind === "link") {
        await userEvent.click(await screen.findByRole("checkbox", { name: /현재 로그인한 TrainOracle 계정을/u }))
        await userEvent.click(screen.getByRole("button", { name: "확인하고 계정 연결" }))
        expect(await screen.findByText(/계정 연결을 마쳤어요/u)).toBeVisible()
      } else {
        await acceptEntry()
        if (kind === "failed-post") expect(await screen.findByText(/처리 결과를 확인하지 못했어요/u)).toBeVisible()
        else await waitFor(() => expect(onNavigate).toHaveBeenCalledTimes(1))
      }
      expect(confirmDiscard).toHaveBeenCalledTimes(kind === "navigate" ? 1 : 0)
      expect(discard).toHaveBeenCalledTimes(kind === "navigate" ? 1 : 0)
      expect(onNavigate).toHaveBeenCalledTimes(kind === "navigate" ? 1 : 0)
    } finally {
      unregister()
    }
  })
})
