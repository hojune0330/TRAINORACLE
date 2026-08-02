// syncNow 조립부 계약 테스트 — pull → merge → push → 삭제 전파 전체 경로.
//
// 왜 별도 파일인가: 기존 sync.contract.test.ts는 순수 함수(mergeEntries,
// toUploadPayload)만 검증했고, 이것들을 **실제로 조립하는** syncNow는
// 무검증이었다. 공격형 검증에서 바로 그 틈에서 결함이 나왔다:
//   서버 tombstone push가 실패해도 "동기화가 끝났어요"라고 성공을 보고했다.
//   → 내가 지운 사실이 서버에 없는 채로 남아 다른 기기가 부활시킨다.
//   삭제권이 걸린 실패를 조용히 넘기는 것은 fail-visible 원칙 위반이다.
import { beforeEach, describe, expect, it, vi } from "vitest"

type Row = Record<string, unknown>

const server = {
  entries: [] as Row[],
  privateNotes: [] as Row[],
  tombstones: [] as Row[],
  tombstonePushFails: false,
  tombstonePullFails: false,
  entryDeleteFails: false,
}

function table(name: string) {
  const isTombstone = name === "journal_tombstones"
  const isPrivateNote = name === "encrypted_private_notes"
  return {
    select() {
      return {
        eq() {
          if (isTombstone) {
            return server.tombstonePullFails
              ? Promise.resolve({ data: null, error: { message: "relation does not exist" } })
              : Promise.resolve({ data: server.tombstones, error: null })
          }
          if (isPrivateNote) return Promise.resolve({ data: server.privateNotes, error: null })
          return Promise.resolve({
            data: server.entries.map((row) => ({ entry: row.entry })),
            error: null,
          })
        },
      }
    },
    upsert(rows: Row[]) {
      if (isTombstone) {
        if (server.tombstonePushFails) {
          return Promise.resolve({ data: null, error: { message: "permission denied" } })
        }
        server.tombstones = rows.map((row) => ({
          entry_id: row.entry_id, deleted_at: row.deleted_at,
        }))
        return Promise.resolve({ data: null, error: null })
      }
      if (isPrivateNote) {
        server.privateNotes = rows
        return Promise.resolve({ data: null, error: null })
      }
      for (const row of rows) {
        const index = server.entries.findIndex((entry) => entry.entry_id === row.entry_id)
        if (index === -1) server.entries.push(row)
        else server.entries[index] = row
      }
      return Promise.resolve({ data: null, error: null })
    },
    delete() {
      return {
        eq() {
          return {
            in(_column: string, ids: readonly string[]) {
              if (isPrivateNote) {
                server.privateNotes = server.privateNotes.filter(
                  (row) => !ids.includes(row.entry_id as string),
                )
                return Promise.resolve({ data: null, error: null })
              }
              if (!isTombstone && server.entryDeleteFails) {
                return Promise.resolve({ data: null, error: { message: "permission denied" } })
              }
              server.entries = server.entries.filter(
                (row) => !ids.includes(row.entry_id as string),
              )
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
      }
    },
  }
}

vi.mock("./supabase-client", () => ({
  supabase: () => Promise.resolve({
    auth: {
      getSession: () => Promise.resolve({
        data: { session: { user: { id: "user-1" } } },
        error: null,
      }),
    },
    from: (name: string) => table(name),
  }),
  __resetSupabaseForTest: () => {},
}))

import { saveSyncConsent, syncNow } from "./sync"
import { saveSessionRecoveryCode } from "./private-note-sync"
import { createRecoveryCode } from "./private-note-crypto"
import { loadTombstones, recordTombstone } from "./tombstone"
import { saveEntry, savePrivateEntry } from "../journal-store"
import type { PostSessionEntry } from "../journal-schema"

const JOURNAL_KEY = "trainoracle.journal.v1"

function post(id: string): PostSessionEntry {
  return {
    id, kind: "post-session", date: "2026-07-20",
    savedAt: "2026-07-20T10:00:00.000Z", syncState: "local",
    system: "base", title: "이지런", distanceKm: "8",
    durationMin: "45", avgPace: "5:30", rpe: 4, memo: "",
  }
}

function memoOnlyPost(id: string): PostSessionEntry {
  return {
    ...post(id),
    title: "",
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe: 0,
    memo: "private",
  }
}

function localIds(): string[] {
  const raw = window.localStorage.getItem(JOURNAL_KEY) ?? "[]"
  return (JSON.parse(raw) as Row[]).map((entry) => entry.id as string)
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  server.entries = []
  server.privateNotes = []
  server.tombstones = []
  server.tombstonePushFails = false
  server.tombstonePullFails = false
  server.entryDeleteFails = false
  saveSyncConsent({ enabled: true, shareTrainingNotes: false })
})

describe("syncNow — 삭제 기록 서버 전파", () => {
  it("삭제 기록 push 실패를 성공으로 보고하지 않는다", async () => {
    saveEntry(post("X"))
    await syncNow("user-1")

    recordTombstone("X", "2026-07-21T00:00:00.000Z")
    window.localStorage.setItem(JOURNAL_KEY, JSON.stringify([]))
    server.tombstonePushFails = true

    const outcome = await syncNow("user-1")

    // 서버에 삭제 기록이 없는데 성공이라 하면 다른 기기가 부활시킨다
    expect(server.tombstones).toHaveLength(0)
    expect(outcome.ok).toBe(false)
    expect(outcome.message).toMatch(/삭제 기록/u)
    // 로컬 삭제는 유지된다 — 실패해도 사용자의 삭제 의도는 지켜진다
    expect(localIds()).toEqual([])
  })

  it("삭제 기록 pull 실패면 병합과 업로드를 시작하지 않는다", async () => {
    server.tombstonePullFails = true
    saveEntry(post("local-stale"))
    server.entries = [{
      user_id: "user-1",
      entry_id: "remote-safe",
      saved_at: "2026-07-20T10:00:00.000Z",
      entry: post("remote-safe"),
    }]

    const outcome = await syncNow("user-1")

    expect(outcome.ok).toBe(false)
    expect(outcome.message).toMatch(/삭제 기록/u)
    expect(server.entries.map((row) => row.entry_id)).toEqual(["remote-safe"])
    expect(localIds()).toEqual(["local-stale"])
  })

  it("정상 경로는 실패 안내 없이 끝난다", async () => {
    saveEntry(post("ok-1"))
    const outcome = await syncNow("user-1")
    expect(outcome.ok).toBe(true)
    expect(outcome.message).not.toMatch(/못했어요/u)
  })

  it("다른 기기가 지운 일지를 이 기기에서도 지운다", async () => {
    server.tombstones = [{ entry_id: "Z", deleted_at: "2026-07-21T00:00:00.000Z" }]
    saveEntry(post("Z"))

    await syncNow("user-1")

    expect(localIds()).toEqual([])
    expect(loadTombstones().map((tombstone) => tombstone.id)).toContain("Z")
  })

  it("다른 기기가 지운 일지를 서버에 다시 밀어 올리지 않는다", async () => {
    server.tombstones = [{ entry_id: "W", deleted_at: "2026-07-21T00:00:00.000Z" }]
    saveEntry(post("W"))

    await syncNow("user-1")

    expect(server.entries.map((row) => row.entry_id)).not.toContain("W")
  })

  it("삭제 기록에는 본문·날짜·수치가 올라가지 않는다 (최소 수집)", async () => {
    recordTombstone("min-1", "2026-07-21T00:00:00.000Z")
    await syncNow("user-1")

    expect(server.tombstones).toHaveLength(1)
    expect(Object.keys(server.tombstones[0] ?? {}).sort()).toEqual(["deleted_at", "entry_id"])
  })

  it("다른 계정으로 바뀌면 이 기기의 일지를 업로드하지 않는다", async () => {
    saveEntry(post("owned-local"))
    expect((await syncNow("user-1")).ok).toBe(true)
    server.entries = []

    const outcome = await syncNow("user-2")

    expect(outcome.ok).toBe(false)
    expect(outcome.message).toContain("matching signed-in account")
    expect(server.entries).toHaveLength(0)
  })

  it("메모 제외로 바꾸면 서버의 메모 전용 일지를 제거한다", async () => {
    const memoOnly = memoOnlyPost("memo-only")
    server.entries = [{
      user_id: "user-1",
      entry_id: memoOnly.id,
      saved_at: memoOnly.savedAt,
      entry: memoOnly,
    }]

    const outcome = await syncNow("user-1")

    expect(outcome.ok).toBe(true)
    expect(server.entries).toHaveLength(0)
  })

  it("서버 메모 제거 실패를 동기화 성공으로 보고하지 않는다", async () => {
    const memoOnly = memoOnlyPost("memo-only")
    server.entries = [{
      user_id: "user-1",
      entry_id: memoOnly.id,
      saved_at: memoOnly.savedAt,
      entry: memoOnly,
    }]
    server.entryDeleteFails = true

    const outcome = await syncNow("user-1")

    expect(outcome.ok).toBe(false)
    expect(outcome.message).toMatch(/메모 제외/u)
  })

  it("나만의 메모는 복구 코드가 있을 때 암호문으로만 서버에 올린다", async () => {
    const code = createRecoveryCode()
    saveSessionRecoveryCode(code)
    await savePrivateEntry({
      ...memoOnlyPost("encrypted-private"),
      memo: "나만 보는 원문",
      memoPurpose: "PRIVATE_SELF_ONLY",
    })

    const outcome = await syncNow("user-1")

    expect(outcome.ok).toBe(true)
    expect(server.privateNotes).toHaveLength(1)
    expect(JSON.stringify(server.privateNotes)).not.toContain("나만 보는 원문")
    expect(server.entries).toHaveLength(0)
  })
})
