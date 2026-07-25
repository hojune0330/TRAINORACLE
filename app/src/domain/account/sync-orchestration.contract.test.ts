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
  tombstones: [] as Row[],
  tombstonePushFails: false,
  tombstonePullFails: false,
}

function table(name: string) {
  const isTombstone = name === "journal_tombstones"
  return {
    select() {
      return {
        eq() {
          if (isTombstone) {
            return server.tombstonePullFails
              ? Promise.resolve({ data: null, error: { message: "relation does not exist" } })
              : Promise.resolve({ data: server.tombstones, error: null })
          }
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
      server.entries = rows
      return Promise.resolve({ data: null, error: null })
    },
    delete() {
      return {
        eq() {
          return {
            in(_column: string, ids: readonly string[]) {
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
  supabase: () => Promise.resolve({ from: (name: string) => table(name) }),
  __resetSupabaseForTest: () => {},
}))

import { saveSyncConsent, syncNow } from "./sync"
import { loadTombstones, recordTombstone } from "./tombstone"
import { saveEntry } from "../journal-store"
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

function localIds(): string[] {
  const raw = window.localStorage.getItem(JOURNAL_KEY) ?? "[]"
  return (JSON.parse(raw) as Row[]).map((entry) => entry.id as string)
}

beforeEach(() => {
  window.localStorage.clear()
  server.entries = []
  server.tombstones = []
  server.tombstonePushFails = false
  server.tombstonePullFails = false
  saveSyncConsent({ enabled: true, includeMemos: false })
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

  it("삭제 기록 pull 실패는 동기화를 막지 않되, 숨기지도 않는다", async () => {
    server.tombstonePullFails = true
    saveEntry(post("Y"))

    const outcome = await syncNow("user-1")

    // 비차단: 마이그레이션 미실행 환경에서도 기존 동기화는 살아 있어야 한다
    expect(outcome.ok).toBe(true)
    // 그러나 반쪽으로 끝났다는 사실은 드러난다
    expect(outcome.tombstoneSyncDegraded).toBe(true)
    expect(outcome.message).toMatch(/삭제 기록/u)
  })

  it("정상 경로에서는 저하 플래그가 서지 않는다", async () => {
    saveEntry(post("ok-1"))
    const outcome = await syncNow("user-1")
    expect(outcome.ok).toBe(true)
    expect(outcome.tombstoneSyncDegraded).toBe(false)
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
})
