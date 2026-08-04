// "다른 계정으로 바꾸기" 화면 계약 테스트 (Q4).
//
// 왜 도메인 테스트만으로 부족한가:
//   releaseSyncOwner는 이미 계약 테스트 12개로 고정했다. 하지만 그 함수가
//   **어디서도 호출되지 않으면 사용자에게는 아무 개선이 없다.** 실제로 이전
//   단계에서 도메인만 만들고 화면이 없어 기능이 없는 상태였다. 이 파일은
//   "도메인은 맞는데 화면이 침묵/오작동"하는 실패 모양을 잡는다.
//
// 이 화면이 반드시 지켜야 하는 것:
//   1. 잠금이 실제로 풀린다 (안 풀리면 아무 문제도 해결되지 않음)
//   2. 일지가 남는다 (지우면 '전부 지우기'와 같아져 존재 의미가 없음)
//   3. 동의가 꺼진다 (안 끄면 새 계정으로 자동 업로드 — 동의 없는 업로드)
//   4. 로그아웃한다 (안 하면 원래 계정에 다시 묶임)
//   5. 실패하면 로그아웃하지 않고 실패를 말한다 (상태 불명 방지)
//   6. 묶여 있지 않으면 나타나지 않는다 (없는 문제로 불안하게 만들지 않음)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SwitchAccountPanel } from "./SwitchAccountPanel"
import { loadSyncConsent, saveSyncConsent } from "../../domain/account/sync"
import { loadTombstones, recordTombstone } from "../../domain/account/tombstone"
import { loadEntries, saveEntry } from "../../domain/journal-store"
import type { PostSessionEntry } from "../../domain/journal-schema"

const OWNER_KEY = "trainoracle.sync.owner.v1"

function post(id: string): PostSessionEntry {
  return {
    id, kind: "post-session", date: "2026-07-20",
    savedAt: "2026-07-20T10:00:00.000Z", syncState: "local",
    system: "base", title: "이지런", distanceKm: "8",
    durationMin: "45", avgPace: "5:30", rpe: 4, memo: "",
  }
}

/** 픽스처가 거부되면 "일지가 남았다"가 0개 대 0개 비교로 공허해진다 (P-3). */
function store(entry: PostSessionEntry): void {
  const result = saveEntry(entry)
  if (!result.ok) throw new Error(`픽스처가 스키마에 거부됐다: ${entry.id}`)
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe("SwitchAccountPanel — 나타나는 조건", () => {
  it("이 기기가 어떤 계정과도 묶여 있지 않으면 아예 보이지 않는다", () => {
    render(<SwitchAccountPanel onSignOut={() => {}} />)

    // 없는 문제를 위한 버튼은 사용자를 불안하게 만든다.
    expect(screen.queryByTestId("switch-account-panel")).toBeNull()
  })

  it("묶여 있으면 '일지를 지우지 않는다'는 사실을 먼저 알린다", () => {
    window.localStorage.setItem(OWNER_KEY, "user-1")

    render(<SwitchAccountPanel onSignOut={() => {}} />)

    expect(screen.getByTestId("switch-account-panel")).toBeTruthy()
    expect(document.body.textContent).toContain("일지를 지우지 않고")
  })
})

describe("SwitchAccountPanel — 연결 끊기", () => {
  it("확인을 눌러야 실제로 끊는다 — 한 번 눌러 바로 끊지 않는다", async () => {
    window.localStorage.setItem(OWNER_KEY, "user-1")
    render(<SwitchAccountPanel onSignOut={() => {}} />)

    await userEvent.click(screen.getByTestId("switch-account-start"))

    // 확인 단계에서는 아직 잠금이 그대로여야 한다.
    expect(window.localStorage.getItem(OWNER_KEY)).toBe("user-1")
    expect(screen.getByTestId("switch-account-confirm")).toBeTruthy()
  })

  it("그만두면 아무것도 바뀌지 않는다", async () => {
    window.localStorage.setItem(OWNER_KEY, "user-1")
    saveSyncConsent({ enabled: true, shareTrainingNotes: false })
    render(<SwitchAccountPanel onSignOut={() => {}} />)

    await userEvent.click(screen.getByTestId("switch-account-start"))
    await userEvent.click(screen.getByTestId("switch-account-cancel"))

    expect(window.localStorage.getItem(OWNER_KEY)).toBe("user-1")
    expect(loadSyncConsent().enabled).toBe(true)
  })

  it("확인하면 잠금이 실제로 풀린다", async () => {
    window.localStorage.setItem(OWNER_KEY, "user-1")
    render(<SwitchAccountPanel onSignOut={() => {}} />)

    await userEvent.click(screen.getByTestId("switch-account-start"))
    await userEvent.click(screen.getByTestId("switch-account-confirm"))

    // 메시지만 바뀌고 키가 남으면 사용자는 또 막힌다.
    expect(window.localStorage.getItem(OWNER_KEY)).toBeNull()
  })

  it("일지와 삭제 기록을 지우지 않는다", async () => {
    store(post("A"))
    store(post("B"))
    recordTombstone("gone", "2026-07-21T00:00:00.000Z")
    window.localStorage.setItem(OWNER_KEY, "user-1")
    render(<SwitchAccountPanel onSignOut={() => {}} />)

    await userEvent.click(screen.getByTestId("switch-account-start"))
    await userEvent.click(screen.getByTestId("switch-account-confirm"))

    expect(loadEntries().map((entry) => entry.id).sort()).toEqual(["A", "B"])
    // 삭제 기록이 사라지면 지웠던 일지가 새 계정에서 되살아난다.
    expect(loadTombstones().map((item) => item.id)).toEqual(["gone"])
  })

  it("동기화 동의를 끈다 — 새 계정으로 말없이 올라가면 안 된다", async () => {
    saveSyncConsent({ enabled: true, shareTrainingNotes: true })
    window.localStorage.setItem(OWNER_KEY, "user-1")
    render(<SwitchAccountPanel onSignOut={() => {}} />)

    await userEvent.click(screen.getByTestId("switch-account-start"))
    await userEvent.click(screen.getByTestId("switch-account-confirm"))

    expect(loadSyncConsent().enabled).toBe(false)
  })

  it("로그아웃까지 한다 — 안 하면 원래 계정에 다시 묶인다", async () => {
    const signOut = vi.fn()
    window.localStorage.setItem(OWNER_KEY, "user-1")
    render(<SwitchAccountPanel onSignOut={signOut} />)

    await userEvent.click(screen.getByTestId("switch-account-start"))
    await userEvent.click(screen.getByTestId("switch-account-confirm"))

    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it("끝난 뒤 일지가 남아 있다는 사실을 화면이 말한다", async () => {
    window.localStorage.setItem(OWNER_KEY, "user-1")
    render(<SwitchAccountPanel onSignOut={() => {}} />)

    await userEvent.click(screen.getByTestId("switch-account-start"))
    await userEvent.click(screen.getByTestId("switch-account-confirm"))

    // "연결을 끊었어요"만 보면 일지도 날아갔다고 겁먹는다.
    expect(screen.getByTestId("switch-account-result").textContent)
      .toContain("일지는 그대로 있어요")
  })
})

describe("SwitchAccountPanel — 실패를 숨기지 않는다", () => {
  it("끊기에 실패하면 실패를 말하고 로그아웃하지 않는다", async () => {
    const signOut = vi.fn()
    window.localStorage.setItem(OWNER_KEY, "user-1")
    render(
      <SwitchAccountPanel
        onSignOut={signOut}
        onRelease={() => ({ ok: false, message: "계정 연결을 끊지 못했어요. 일지는 그대로 있어요." })}
      />,
    )

    await userEvent.click(screen.getByTestId("switch-account-start"))
    await userEvent.click(screen.getByTestId("switch-account-confirm"))

    expect(screen.getByTestId("switch-account-result").textContent).toContain("끊지 못했어요")
    // 잠금이 그대로인데 로그아웃까지 하면 사용자는 상태를 알 수 없게 된다.
    expect(signOut).not.toHaveBeenCalled()
  })
})

describe("SwitchAccountPanel — 백업 권유", () => {
  it("백업 경로가 있으면 끊기 전에 권한다 (강요하지 않는다)", async () => {
    const openBackup = vi.fn()
    window.localStorage.setItem(OWNER_KEY, "user-1")
    render(<SwitchAccountPanel onSignOut={() => {}} onOpenBackup={openBackup} />)

    await userEvent.click(screen.getByTestId("switch-account-start"))
    // 백업은 권유일 뿐이므로 끊기 버튼이 함께 보여야 한다(백업 강제 아님).
    expect(screen.getByTestId("switch-account-confirm")).toBeTruthy()

    await userEvent.click(screen.getByTestId("switch-account-backup"))
    expect(openBackup).toHaveBeenCalledTimes(1)
  })

  it("백업 경로가 없으면 권유 버튼을 만들지 않는다", async () => {
    window.localStorage.setItem(OWNER_KEY, "user-1")
    render(<SwitchAccountPanel onSignOut={() => {}} />)

    await userEvent.click(screen.getByTestId("switch-account-start"))

    // 눌러도 아무 일이 없는 버튼은 두지 않는다.
    expect(screen.queryByTestId("switch-account-backup")).toBeNull()
  })
})
