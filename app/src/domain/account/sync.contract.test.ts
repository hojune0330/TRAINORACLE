// 계정·동기화 계약 테스트
// 1) mergeEntries: id 기준 LWW(savedAt), 동률 로컬 승리, 단독 항목 보존
// 2) 동의 상태: 기본 OFF, 저장/복원, 깨진 JSON에도 안전 기본값
// 3) 업로드 페이로드: 기본은 메모 원문 제거(safe-export), 토글 ON일 때만 포함
// 4) replaceAllEntries: fail-closed (유효 항목만 기록)
// 5) feature flag OFF: 인증 함수가 안전한 실패값 반환
import { beforeEach, describe, expect, it } from "vitest"
import type { JournalEntry, PostSessionEntry } from "../journal-schema"
import { loadEntries, replaceAllEntries } from "../journal-store"
import {
  loadSyncConsent, mergeEntries, saveSyncConsent, toUploadPayload,
} from "./sync"
import { requestEmailOtp, signInWithGoogle, currentUser } from "./auth"
import { accountFeatureEnabled } from "./config"

const CONSENT_KEY = "trainoracle.sync.consent.v1"
const JOURNAL_KEY = "trainoracle.journal.v1"

function post(id: string, savedAt: string, overrides: Partial<PostSessionEntry> = {}): PostSessionEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-07-20",
    savedAt,
    syncState: "local",
    system: "base",
    title: "이지런",
    distanceKm: "8",
    durationMin: "45",
    avgPace: "5:30",
    rpe: 4,
    memo: "오늘 메모",
    memoPurpose: "ANALYZABLE_TRAINING_NOTE",
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe("mergeEntries — id 기준 LWW", () => {
  it("같은 id면 savedAt이 더 큰 쪽이 남는다", () => {
    const local = [post("a", "2026-07-20T10:00:00.000Z", { title: "로컬판" })]
    const remote = [post("a", "2026-07-21T10:00:00.000Z", { title: "서버판" })]
    const merged = mergeEntries(local, remote)
    expect(merged).toHaveLength(1)
    expect((merged[0] as PostSessionEntry).title).toBe("서버판")
  })

  it("savedAt 동률이면 로컬이 승리한다", () => {
    const t = "2026-07-20T10:00:00.000Z"
    const local = [post("a", t, { title: "로컬판" })]
    const remote = [post("a", t, { title: "서버판" })]
    const merged = mergeEntries(local, remote)
    expect((merged[0] as PostSessionEntry).title).toBe("로컬판")
  })

  it("한쪽에만 있는 항목은 모두 보존된다", () => {
    const local = [post("only-local", "2026-07-20T10:00:00.000Z")]
    const remote = [post("only-remote", "2026-07-19T10:00:00.000Z", { date: "2026-07-19" })]
    const merged = mergeEntries(local, remote)
    expect(merged.map((entry) => entry.id).sort()).toEqual(["only-local", "only-remote"])
  })

  it("결과는 date 오름차순으로 정렬된다", () => {
    const local = [post("b", "2026-07-22T10:00:00.000Z", { date: "2026-07-22" })]
    const remote = [post("a", "2026-07-19T10:00:00.000Z", { date: "2026-07-19" })]
    const merged = mergeEntries(local, remote)
    expect(merged.map((entry) => entry.date)).toEqual(["2026-07-19", "2026-07-22"])
  })

  it("빈 입력끼리 병합하면 빈 배열", () => {
    expect(mergeEntries([], [])).toEqual([])
  })
})

describe("동기화 동의 상태 — 메모 목적 분리", () => {
  it("저장된 값이 없으면 동기화와 훈련 메모 공유가 꺼져 있다", () => {
    expect(loadSyncConsent()).toEqual({ enabled: false, shareTrainingNotes: false })
  })

  it("저장 후 복원된다", () => {
    saveSyncConsent({ enabled: true, shareTrainingNotes: true })
    expect(loadSyncConsent()).toEqual({ enabled: true, shareTrainingNotes: true })
  })

  it("깨진 JSON이면 안전 기본값으로 돌아간다", () => {
    window.localStorage.setItem(CONSENT_KEY, "{broken")
    expect(loadSyncConsent()).toEqual({ enabled: false, shareTrainingNotes: false })
  })

  it("불리언이 아닌 값은 false로 강제된다", () => {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ enabled: "yes", shareTrainingNotes: 1 }))
    expect(loadSyncConsent()).toEqual({ enabled: false, shareTrainingNotes: false })
  })
})

describe("업로드 페이로드 — 메모 목적별 경계", () => {
  it("훈련 메모 공유를 끄면 memo/memoPurpose가 제거된다", () => {
    const payload = toUploadPayload(post("a", "2026-07-20T10:00:00.000Z"), {
      enabled: true, shareTrainingNotes: false,
    })
    expect(payload).not.toBeNull()
    expect(payload).not.toHaveProperty("memo")
    expect(payload).not.toHaveProperty("memoPurpose")
    expect(payload).toHaveProperty("rpe", 4)
  })

  it("훈련 메모 공유를 켜면 훈련 메모 원문만 포함된다", () => {
    const payload = toUploadPayload(post("a", "2026-07-20T10:00:00.000Z"), {
      enabled: true, shareTrainingNotes: true,
    })
    expect(payload).toHaveProperty("memo", "오늘 메모")
  })

  it("나만의 메모 원문은 공유 설정과 관계없이 구조화 페이로드에서 제외된다", () => {
    const payload = toUploadPayload(post("a", "2026-07-20T10:00:00.000Z", {
      memo: "절대 공유하지 않을 일기",
      memoPurpose: "PRIVATE_SELF_ONLY",
    }), { enabled: true, shareTrainingNotes: true })

    expect(payload).not.toHaveProperty("memo")
    expect(payload).not.toHaveProperty("memoPurpose")
  })
})

describe("replaceAllEntries — fail-closed", () => {
  it("유효 항목만 기록하고 무효 항목은 버린다", () => {
    const valid = post("ok", "2026-07-20T10:00:00.000Z")
    const invalid = { id: "bad", kind: "post-session" } // 필수 필드 결손
    const result = replaceAllEntries([valid, invalid])
    expect(result.ok).toBe(true)
    expect(result.total).toBe(1)
    expect(loadEntries().map((entry) => entry.id)).toEqual(["ok"])
  })

  it("기존 데이터를 병합 결과로 교체한다", () => {
    window.localStorage.setItem(JOURNAL_KEY, JSON.stringify([post("old", "2026-07-01T10:00:00.000Z", { date: "2026-07-01" })]))
    const next: JournalEntry[] = [post("new", "2026-07-20T10:00:00.000Z")]
    const result = replaceAllEntries(next)
    expect(result.ok).toBe(true)
    expect(loadEntries().map((entry) => entry.id)).toEqual(["new"])
  })
})

describe("feature flag OFF — 계정 기능 완전 비활성", () => {
  it("테스트 환경(env 미설정)에서 flag는 꺼져 있다", () => {
    expect(accountFeatureEnabled()).toBe(false)
  })

  it("OTP 요청은 안전한 실패값을 돌려준다", async () => {
    const result = await requestEmailOtp("runner@example.com")
    expect(result.ok).toBe(false)
    expect(result.message).toContain("꺼져")
  })

  it("Google 로그인도 안전한 실패값을 돌려준다", async () => {
    const result = await signInWithGoogle()
    expect(result.ok).toBe(false)
  })

  it("currentUser는 null", async () => {
    expect(await currentUser()).toBeNull()
  })
})

// ── 공격형 검증 회귀 방지 ──────────────────────────────────────────
// 발견: 메모 제외 동기화가 fieldProvenance까지 버려서, 기기A에서 통계에
// 잡히던 일지가 기기B로 동기화되면 **통계에서 조용히 사라졌다.**
describe("동기화가 분석 자격을 파괴하지 않는다 (회귀 방지)", () => {
  it("메모 제외 업로드 페이로드가 출처를 보존한다", () => {
    const entry = {
      id: "prov-1", kind: "post-session", date: "2026-07-20",
      savedAt: "2026-07-20T10:00:00.000Z", syncState: "local",
      system: "base", title: "이지런", distanceKm: "8", durationMin: "45",
      avgPace: "5:30", rpe: 4, memo: "비밀 메모",
      memoPurpose: "PRIVATE_SELF_ONLY",
      fieldProvenance: { distanceKm: { provenance: "EXPLICIT" } },
    } satisfies JournalEntry

    const payload = toUploadPayload(entry, { enabled: true, shareTrainingNotes: false })

    // 메모는 여전히 빠져야 한다 (프라이버시 기본값 유지)
    expect(payload?.memo).toBeUndefined()
    expect(payload?.memoPurpose).toBeUndefined()
    // 출처는 보존되어야 한다 (분석 자격 유지)
    expect(payload?.fieldProvenance).toEqual({ distanceKm: { provenance: "EXPLICIT" } })
  })
})
