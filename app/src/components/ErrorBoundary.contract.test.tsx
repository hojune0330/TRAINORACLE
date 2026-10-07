// 오류 경계 계약 테스트.
//
// 핵심 계약: 화면이 깨져도 사용자가 **자기 일지에 닿을 수 있어야 한다.**
// 흰 화면이 되면 기기에만 있는 기록에 접근할 방법이 사라진다.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import { ErrorBoundary, emergencyJournalBackupRaw, readEmergencyJournalBackup } from "./ErrorBoundary"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"

const JOURNAL_KEY = "trainoracle.journal.v1"

function Boom(): React.ReactElement {
  throw new Error("의도적 렌더 실패")
}

beforeEach(() => {
  window.localStorage.clear()
  setActiveLocalAccount(null)
  // React가 경계 테스트에서 콘솔에 찍는 오류를 잠시 가린다
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  setActiveLocalAccount(null)
  vi.restoreAllMocks()
})

describe("ErrorBoundary", () => {
  it("정상일 때는 자식을 그대로 보여준다", () => {
    render(<ErrorBoundary><p>정상 화면</p></ErrorBoundary>)
    expect(screen.getByText("정상 화면")).toBeTruthy()
  })

  it("렌더가 깨져도 흰 화면이 되지 않는다", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByTestId("error-boundary")).toBeTruthy()
    expect(screen.getByText(/문제가 생겼어요/u)).toBeTruthy()
  })

  it("일지가 남아 있다는 사실과 개수를 알려준다", () => {
    window.localStorage.setItem(JOURNAL_KEY, JSON.stringify([{ id: "a" }, { id: "b" }, { id: "c" }]))
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    // 사용자가 가장 먼저 걱정하는 것은 "내 기록이 날아갔나"다
    expect(screen.getByText(/읽을 수 있는 일지 3개/u)).toBeTruthy()
  })

  it("오류 화면에서 바로 백업을 받을 수 있다", () => {
    window.localStorage.setItem(JOURNAL_KEY, JSON.stringify([{ id: "a" }]))
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    // "다시 시도"만 있으면 같은 오류가 반복될 때 탈출구가 없다
    expect(screen.getByTestId("error-download-backup")).toBeTruthy()
  })

  it("오류 백업에서도 다른 계정의 일지를 제외한다", () => {
    window.localStorage.setItem(JOURNAL_KEY, JSON.stringify([
      { id: "device", title: "기기 일지" },
      { id: "mine", title: "내 일지" },
      { id: "other", title: "다른 계정 일지" },
    ]))
    window.localStorage.setItem("trainoracle.journal.ownership.v1", JSON.stringify({
      schemaVersion: 1,
      ownerByEntryId: { mine: "account-a", other: "account-b" },
    }))
    setActiveLocalAccount("account-a")

    expect(JSON.parse(emergencyJournalBackupRaw())).toEqual([
      { id: "device", title: "기기 일지" },
      { id: "mine", title: "내 일지" },
    ])
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText(/읽을 수 있는 일지 2개/u)).toBeTruthy()
  })

  it("소유권 장부가 손상되면 공용 원문을 내보내지 않는다", () => {
    window.localStorage.setItem(JOURNAL_KEY, JSON.stringify([{ id: "possibly-private" }]))
    window.localStorage.setItem("trainoracle.journal.ownership.v1", "{broken")

    expect(emergencyJournalBackupRaw()).toBe("[]")
  })

  it("reads one fresh ownership snapshot for a large emergency backup", () => {
    const entries = Array.from({ length: 500 }, (_, index) => ({ id: `synthetic-${index}` }))
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries))
    localStorage.setItem("trainoracle.journal.ownership.v1", JSON.stringify({
      schemaVersion: 1, ownerByEntryId: { "synthetic-499": "another-account" },
    }))
    const read = vi.spyOn(Storage.prototype, "getItem")
    expect(readEmergencyJournalBackup()).toEqual({ kind: "ready", count: 499, raw: JSON.stringify(entries.slice(0, 499)) })
    expect(read.mock.calls.filter(([key]) => key === "trainoracle.journal.ownership.v1")).toHaveLength(1)
  })

  it("다시 열어 보기 경로를 제공한다", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByTestId("error-retry")).toBeTruthy()
  })

  it("actually retries a transient render error", () => {
    let fail = true
    function Transient() { if (fail) throw new Error("render failed"); return <p>복구된 화면</p> }
    render(<ErrorBoundary region><Transient /></ErrorBoundary>)
    fail = false
    fireEvent.click(screen.getByTestId("error-retry"))
    expect(screen.getByText("복구된 화면")).toBeTruthy()
  })

  it("keeps navigation and a sibling screen mounted when one region fails", () => {
    const exit = vi.fn()
    render(<><button onClick={exit}>다른 탭</button><input aria-label="작성 중" defaultValue="kept" />
      <ErrorBoundary region><Boom /></ErrorBoundary></>)
    fireEvent.click(screen.getByText("다른 탭"))
    expect(exit).toHaveBeenCalledOnce()
    expect(screen.getByLabelText("작성 중")).toHaveValue("kept")
  })

  it("does not claim a malformed or unreadable backup is empty or safe", () => {
    localStorage.setItem(JOURNAL_KEY, "{broken")
    expect(readEmergencyJournalBackup()).toEqual({ kind: "unavailable" })
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByTestId("error-download-backup")).toBeDisabled()
    expect(screen.getByText(/확인하지 못해 백업/u)).toBeTruthy()
    expect(localStorage.getItem(JOURNAL_KEY)).toBe("{broken")
  })

  it("reports a download failure instead of silently claiming success", () => {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify([{ id: "a" }]))
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => { throw new Error("blocked") })
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    fireEvent.click(screen.getByTestId("error-download-backup"))
    expect(screen.getByRole("status")).toHaveTextContent("백업 파일을 만들지 못했어요")
  })

  it("오류 내용을 외부로 보내지 않는다고 명시한다", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText(/기기 밖으로 전송되지 않아요/u)).toBeTruthy()
  })

  it("GitHub 대신 앱 안의 문의 게시판으로 안내한다", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    const link = screen.getByRole("link", { name: "문의 게시판에 알리기" })
    expect(link).toHaveAttribute("href", "?feedback=1")
  })
})
