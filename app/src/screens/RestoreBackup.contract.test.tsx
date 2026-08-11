// 백업 되돌리기 화면 계약 — 복원이 사고를 내지 않는다는 약속을 잠근다.
//
// 잠그는 약속:
//  1. 파일을 고르기 전에 "지금 일지를 지우지 않는다"는 안내가 보인다.
//  2. 백업이 아닌 파일은 조용히 삼키지 않는다 — 실패를 보여주고 일지는 그대로다.
//  3. 겹치는 일지의 기본값은 "지금 것을 지킨다"이고, 덮어쓰기는 직접 골라야 한다.
//  4. 지운 일지는 백업 파일로도 되살아나지 않으며 그 사실이 화면에 보인다.
//  5. 읽지 못한 항목 수를 숨기지 않는다(fail-visible).
//  6. 안전 백업(메모 제외)은 메모가 비어 있다는 사실을 알리고, 없는 내용을 만들지 않는다.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RestoreBackup } from "./RestoreBackup"
import { loadEntries, saveEntry, deleteEntry } from "../domain/journal-store"
import { FULL_FORMAT, SAFE_FORMAT } from "../domain/restore/backup-file"
import type { PostSessionEntry } from "../domain/journal-schema"
import { loadDecorationState } from "../domain/decoration-store"
import { JOURNAL_STORAGE_KEY } from "../domain/journal-local-storage"
import { createRecoveryCode } from "../domain/account/private-note-crypto"
import { saveSessionRecoveryCode } from "../domain/account/private-note-sync"

afterEach(cleanup)

function postSession(
  id: string,
  date: string,
  overrides: Partial<PostSessionEntry> = {},
): PostSessionEntry {
  return {
    id, date, savedAt: `${date}T09:00:00.000Z`, syncState: "local",
    kind: "post-session",
    system: "base", title: "이지런",
    distanceKm: "8", durationMin: "45", avgPace: "5:30", rpe: 4,
    memo: "",
    ...overrides,
  }
}

function backupFile(
  entries: readonly unknown[],
  format: string = FULL_FORMAT,
  name = "trainoracle-full-backup-2026-07-25.json",
  decorations?: unknown,
): File {
  const body = JSON.stringify({
    app: "TRAINORACLE",
    format,
    exportedAt: "2026-07-25T00:00:00.000Z",
    entries,
    ...(decorations === undefined ? {} : { decorations }),
  })
  return new File([body], name, { type: "application/json" })
}

async function pick(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.upload(screen.getByLabelText(/백업 파일/u), file)
}

describe("RestoreBackup — 고르기 단계", () => {
  beforeEach(() => { window.localStorage.clear() })

  it("파일을 고르기 전에 기존 일지를 지우지 않는다는 안내가 보인다", () => {
    render(<RestoreBackup />)
    const notice = screen.getByTestId("restore-privacy-notice")
    expect(notice.textContent).toMatch(/지운 뒤 넣는 게 아니에요/u)
    expect(notice.textContent).toMatch(/그대로 두고/u)
  })

  it("파일이 이 기기에서만 읽힌다는 사실을 알린다", () => {
    render(<RestoreBackup />)
    expect(screen.getByTestId("restore-privacy-notice").textContent)
      .toMatch(/이 기기에서만\s*읽고 어디로도 올리지 않아요/u)
  })

  it("백업이 아닌 파일은 실패를 보여주고 일지를 건드리지 않는다", async () => {
    const user = userEvent.setup()
    saveEntry(postSession("keep-me", "2026-07-20"))
    render(<RestoreBackup />)

    await pick(user, new File(["not a backup at all"], "random.json", { type: "application/json" }))

    await waitFor(() => {
      expect(screen.getByTestId("restore-failure").textContent).toMatch(/읽지 못했어요/u)
    })
    expect(screen.getByTestId("restore-failure").textContent).toMatch(/기존 일지는 그대로 있어요/u)
    expect(loadEntries().map((entry) => entry.id)).toEqual(["keep-me"])
  })

  it("형식은 맞지만 비어 있는 백업은 '빈 백업'으로 구분해서 알린다", async () => {
    const user = userEvent.setup()
    render(<RestoreBackup />)

    await pick(user, backupFile([]))

    await waitFor(() => {
      expect(screen.getByTestId("restore-failure").textContent).toMatch(/빈 백업일 수 있어요/u)
    })
  })
})

describe("RestoreBackup — 검토 단계", () => {
  beforeEach(() => { window.localStorage.clear() })

  it("새로 들어올 개수를 보여주고 버튼에 그 수를 적는다", async () => {
    const user = userEvent.setup()
    render(<RestoreBackup />)

    await pick(user, backupFile([postSession("a", "2026-07-21"), postSession("b", "2026-07-22")]))

    await waitFor(() => {
      expect(screen.getByTestId("restore-summary").textContent).toMatch(/일지 2건을 읽었어요/u)
    })
    expect(screen.getByRole("button", { name: /2건 되돌리기/u })).toBeTruthy()
    // 아직 저장 전 — 일지는 비어 있다
    expect(loadEntries()).toHaveLength(0)
  })

  it("겹치는 일지가 있으면 기본값이 '지금 것을 지켜요'다", async () => {
    const user = userEvent.setup()
    saveEntry(postSession("dup", "2026-07-20", { title: "이 기기 제목" }))
    render(<RestoreBackup />)

    await pick(user, backupFile([
      postSession("dup", "2026-07-20", { title: "백업 제목" }),
      postSession("new", "2026-07-21"),
    ]))

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /지금 것을 지켜요/u }).getAttribute("aria-checked")).toBe("true")
    })
    expect(screen.getByRole("radio", { name: /백업 파일 내용으로 바꿔요/u }).getAttribute("aria-checked")).toBe("false")
    // 기본값에서는 겹치지 않는 1건만 대상
    expect(screen.getByRole("button", { name: /1건 되돌리기/u })).toBeTruthy()
  })

  it("전에 지운 일지는 되돌리지 않고, 그 사실을 화면에 보여준다", async () => {
    const user = userEvent.setup()
    saveEntry(postSession("deleted-one", "2026-07-19"))
    deleteEntry("deleted-one")
    render(<RestoreBackup />)

    await pick(user, backupFile([postSession("deleted-one", "2026-07-19"), postSession("fresh", "2026-07-21")]))

    await waitFor(() => {
      expect(screen.getByTestId("restore-blocked-deleted").textContent).toMatch(/1건/u)
    })
    expect(screen.getByRole("button", { name: /1건 되돌리기/u })).toBeTruthy()
  })

  it("읽지 못한 항목 수를 숨기지 않는다", async () => {
    const user = userEvent.setup()
    render(<RestoreBackup />)

    await pick(user, backupFile([postSession("ok", "2026-07-21"), { id: "broken", nope: true }]))

    await waitFor(() => {
      expect(screen.getByTestId("restore-skipped").textContent).toMatch(/1건/u)
    })
  })

  it("안전 백업은 메모가 비어 있다는 사실을 알린다", async () => {
    const user = userEvent.setup()
    render(<RestoreBackup />)

    // 안전 내보내기는 memo/memoPurpose를 제거한다
    const { memo: _memo, ...safe } = postSession("s1", "2026-07-21")
    await pick(user, backupFile([safe], SAFE_FORMAT, "trainoracle-journal-2026-07-25.json"))

    await waitFor(() => {
      expect(screen.getByTestId("restore-summary").textContent).toMatch(/메모 제외 백업/u)
    })
    expect(screen.getByText(/메모 원문이 들어 있지 않아요/u)).toBeTruthy()
    expect(screen.getByText(/없는 내용을 만들어 채우지 않아요/u)).toBeTruthy()
  })
})

describe("RestoreBackup — 되돌리기 실행", () => {
  beforeEach(() => { window.localStorage.clear() })

  it("고른 만큼만 일지에 저장하고 결과를 보여준다", async () => {
    const user = userEvent.setup()
    render(<RestoreBackup />)

    await pick(user, backupFile([postSession("a", "2026-07-21"), postSession("b", "2026-07-22")]))
    await waitFor(() => screen.getByRole("button", { name: /2건 되돌리기/u }))
    await user.click(screen.getByRole("button", { name: /2건 되돌리기/u }))

    expect(screen.getByTestId("restore-done").textContent).toMatch(/2건을 일지에 되돌렸어요/u)
    expect(loadEntries().map((entry) => entry.id).sort()).toEqual(["a", "b"])
  })

  it("메모 제외 파일에 주입한 문구는 저장 전에 지운다", async () => {
    const user = userEvent.setup()
    const rawMemo = "RESTORE_SCREEN_SAFE_MEMO_SENTINEL"
    render(<RestoreBackup />)

    await pick(user, backupFile([
      { ...postSession("safe-injected", "2026-07-21", { memo: rawMemo, memoPurpose: "ANALYZABLE_TRAINING_NOTE" }), note: rawMemo },
    ], SAFE_FORMAT, "trainoracle-journal-2026-07-25.json"))
    await waitFor(() => screen.getByRole("button", { name: /1건 되돌리기/u }))
    await user.click(screen.getByRole("button", { name: /1건 되돌리기/u }))

    expect(screen.getByTestId("restore-done").textContent).toMatch(/1건을 일지에 되돌렸어요/u)
    expect(JSON.stringify(loadEntries())).not.toContain(rawMemo)
    expect(loadEntries()[0]?.memoPurpose).toBeUndefined()
  })

  it("기본값에서는 겹치는 일지의 지금 내용이 그대로 남는다", async () => {
    const user = userEvent.setup()
    saveEntry(postSession("dup", "2026-07-20", { title: "이 기기 제목" }))
    render(<RestoreBackup />)

    await pick(user, backupFile([postSession("dup", "2026-07-20", { title: "백업 제목" })]))
    await waitFor(() => screen.getByTestId("restore-summary"))
    // 되돌릴 것이 없다 — 버튼이 잠겨 있다
    const button = screen.getByRole("button", { name: /되돌릴 일지가 없어요/u })
    expect(button.hasAttribute("disabled")).toBe(true)

    const kept = loadEntries()[0]
    expect(kept?.kind === "post-session" ? kept.title : null).toBe("이 기기 제목")
  })

  it("덮어쓰기를 직접 고르면 백업 내용으로 바뀌고 id가 늘어나지 않는다", async () => {
    const user = userEvent.setup()
    saveEntry(postSession("dup", "2026-07-20", { title: "이 기기 제목" }))
    render(<RestoreBackup />)

    await pick(user, backupFile([postSession("dup", "2026-07-20", { title: "백업 제목" })]))
    await waitFor(() => screen.getByRole("radio", { name: /백업 파일 내용으로 바꿔요/u }))
    await user.click(screen.getByRole("radio", { name: /백업 파일 내용으로 바꿔요/u }))
    await user.click(screen.getByRole("button", { name: /1건 되돌리기/u }))

    expect(screen.getByTestId("restore-done").textContent).toMatch(/1건을 일지에 되돌렸어요/u)
    const entries = loadEntries()
    expect(entries).toHaveLength(1)
    const only = entries[0]
    expect(only?.kind === "post-session" ? only.title : null).toBe("백업 제목")
  })

  it("지운 일지는 되돌리기를 실행해도 살아나지 않는다", async () => {
    const user = userEvent.setup()
    saveEntry(postSession("gone", "2026-07-19"))
    deleteEntry("gone")
    render(<RestoreBackup />)

    await pick(user, backupFile([postSession("gone", "2026-07-19"), postSession("ok", "2026-07-21")]))
    await waitFor(() => screen.getByRole("button", { name: /1건 되돌리기/u }))
    await user.click(screen.getByRole("button", { name: /1건 되돌리기/u }))

    expect(loadEntries().map((entry) => entry.id)).toEqual(["ok"])
    expect(screen.getByTestId("restore-done").textContent).toMatch(/전에 지운 일지 1건은 되돌리지 않았어요/u)
  })
})
describe("restore backup decorations preview", () => {
  beforeEach(() => { window.localStorage.clear() })

  it("keeps journal entries separate from decorations in the restore summary for full backups", async () => {
    const user = userEvent.setup()
    render(<RestoreBackup />)

    const backup = JSON.stringify({
      app: "TRAINORACLE",
      format: FULL_FORMAT,
      exportedAt: "2026-07-25T00:00:00.000Z",
      entries: [postSession("journal-only", "2026-07-21")],
      decorations: loadDecorationState(),
    })

    await pick(user, new File([backup], "trainoracle-full-backup-2026-07-25.json", { type: "application/json" }))

    await waitFor(() => {
      expect(screen.getByTestId("restore-decoration-summary").textContent).toContain("꾸미기")
    })
  })

  it("전체 백업의 꾸미기 항목과 날짜 배치 수를 저장 전에 보여준다", async () => {
    const user = userEvent.setup()
    render(<RestoreBackup />)
    const decorations = {
      version: 2,
      spentPoints: 0,
      ownedItemIds: ["THEME_TRACK_NOTEBOOK", "INK_NAVY", "STICKER_WEATHER_SUN", "STAMP_REST_DAY", "TAPE_CHECKER"],
      equipped: { themeId: "THEME_TRACK_NOTEBOOK", inkId: "INK_NAVY", avatarId: null },
      library: { favoriteItemIds: [], recentItemIds: [] },
      pagePlacements: [
        { date: "2026-07-21", slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" },
      ],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    }

    await pick(user, backupFile([postSession("a", "2026-07-21")], FULL_FORMAT, undefined, decorations))

    await waitFor(() => {
      expect(screen.getByTestId("restore-decoration-summary").textContent).toMatch(/꾸미기 항목 5개/u)
    })
    expect(screen.getByTestId("restore-decoration-summary").textContent).toMatch(/날짜 배치 1개/u)
  })

  it("잘못된 꾸미기 구획은 일지와 분리해 경고한다", async () => {
    const user = userEvent.setup()
    render(<RestoreBackup />)

    await pick(user, backupFile(
      [postSession("a", "2026-07-21")],
      FULL_FORMAT,
      undefined,
      { version: 99, pagePlacements: [] },
    ))

    await waitFor(() => {
      expect(screen.getByTestId("restore-decoration-invalid").textContent)
        .toMatch(/꾸미기는 형식이 맞지 않아 제외/u)
    })
    expect(screen.getByRole("button", { name: /1건 되돌리기/u })).toBeTruthy()
  })
})

describe("restore backup failure boundaries", () => {
  beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear() })

  it("does not present a rolled-back full restore as success", async () => {
    const user = userEvent.setup()
    const backup = backupFile(
      [postSession("journal", "2026-07-21")],
      FULL_FORMAT,
      undefined,
      loadDecorationState(),
    )
    const setItem = window.localStorage.setItem.bind(window.localStorage)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (key === JOURNAL_STORAGE_KEY) throw new DOMException("quota")
      setItem(key, value)
    })
    render(<RestoreBackup />)

    await pick(user, backup)
    await user.click(screen.getByTestId("restore-submit"))

    await waitFor(() => expect(screen.getByTestId("restore-commit-failure")).toBeTruthy())
    expect(screen.queryByTestId("restore-done")).toBeNull()
  })

  it("distinguishes a missing recovery code from an unreadable backup", async () => {
    const user = userEvent.setup()
    render(<RestoreBackup />)
    const backup = backupFile([
      postSession("private", "2026-07-21", {
        memo: "private backup memo",
        memoPurpose: "PRIVATE_SELF_ONLY",
      }),
    ])

    await pick(user, backup)
    await user.click(screen.getByTestId("restore-submit"))

    await waitFor(() => {
      expect(screen.getByTestId("restore-commit-failure").textContent).toMatch(/복구 코드/u)
    })
    expect(screen.queryByTestId("restore-failure")).toBeNull()
  })

  it("locks repeated restore clicks while a private restore is still running", async () => {
    const user = userEvent.setup()
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    render(<RestoreBackup />)
    const backup = backupFile([
      postSession("private", "2026-07-21", {
        memo: "private backup memo",
        memoPurpose: "PRIVATE_SELF_ONLY",
      }),
    ])
    await pick(user, backup)
    const setItem = window.localStorage.setItem.bind(window.localStorage)
    const journalWrites = vi.fn()
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (key === JOURNAL_STORAGE_KEY) journalWrites()
      setItem(key, value)
    })

    const submit = screen.getByTestId("restore-submit")
    fireEvent.click(submit)
    fireEvent.click(submit)

    await waitFor(() => expect(screen.getByTestId("restore-done")).toBeTruthy())
    expect(journalWrites).toHaveBeenCalledTimes(1)
  })
})
