import { z } from "zod"
import type { JournalEntry } from "../journal-schema"
import { toExportJournalEntry } from "../safe-export"
import { tombstonedIds } from "./tombstone"

const CONSENT_KEY = "trainoracle.sync.consent.v1"
const BINDING_KEY = "trainoracle.sync.owner.v1"

const syncConsentSchema = z.object({
  enabled: z.boolean(),
  shareTrainingNotes: z.boolean(),
})

export type SyncConsent = z.infer<typeof syncConsentSchema>

const DEFAULT_CONSENT: SyncConsent = { enabled: false, shareTrainingNotes: false }

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage
  } catch {
    return null
  }
}

export function loadSyncConsent(): SyncConsent {
  const localStorage = storage()
  if (localStorage === null) return DEFAULT_CONSENT
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (raw === null) return DEFAULT_CONSENT
    const parsedJson: unknown = JSON.parse(raw)
    const parsed = syncConsentSchema.safeParse(parsedJson)
    return parsed.success ? parsed.data : DEFAULT_CONSENT
  } catch (error) {
    if (error instanceof SyntaxError) return DEFAULT_CONSENT
    throw error
  }
}

export function saveSyncConsent(consent: SyncConsent): boolean {
  const localStorage = storage()
  if (localStorage === null) return false
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
    return true
  } catch {
    return false
  }
}

export function claimSyncBinding(userId: string): boolean {
  if (userId === "") return false
  const localStorage = storage()
  if (localStorage === null) return false
  try {
    const boundUserId = localStorage.getItem(BINDING_KEY)
    if (boundUserId !== null) return boundUserId === userId
    localStorage.setItem(BINDING_KEY, userId)
    return localStorage.getItem(BINDING_KEY) === userId
  } catch {
    return false
  }
}

/** 이 기기가 묶여 있는 계정 userId — 없으면 null. 화면에서 상태를 보여줄 때 쓴다. */
export function currentSyncOwner(): string | null {
  const localStorage = storage()
  if (localStorage === null) return null
  try {
    return localStorage.getItem(BINDING_KEY)
  } catch {
    return null
  }
}

export type ReleaseOwnerResult = {
  readonly ok: boolean
  /** 사용자에게 그대로 보여줄 수 있는 문장 — 실패를 숨기지 않는다 */
  readonly message: string
}

/**
 * 이 기기를 계정 잠금에서 풀어준다 — **일지는 지우지 않는다.** (Q4)
 *
 * 왜 필요한가:
 *  `claimSyncBinding`은 기기 하나를 계정 하나에 묶는다. 그 자체는 반드시 필요하다
 *  (없으면 내 일지가 남의 계정으로 올라간다). 문제는 이 잠금이 기기를 정당하게
 *  넘겨받은 사람에게도 걸리고, 잠금을 푸는 유일한 수단이 **전체 삭제**였다는
 *  것이다. 계정만 바꾸려는 사람에게 "일지를 다 지우세요"는 과한 요구다.
 *
 * 왜 잠금 키만 지우는가:
 *  - 일지·계획: 그대로 둔다. 이 함수의 존재 이유가 그것이다.
 *  - 삭제 기록(tombstone): 그대로 둔다. 지우면 지웠던 일지가 새 계정에서
 *    되살아난다. 계정을 바꾸는 것과 삭제를 되돌리는 것은 다른 일이다.
 *  - 동기화 동의: 그대로 둔다. 새 계정으로 **자동 업로드되면 안 되므로**
 *    호출하는 쪽에서 동의를 끄고 로그아웃까지 함께 처리한다(화면의 책임).
 *
 * 실패를 숨기지 않는다. 지워졌는지 다시 읽어 확인하고, 실패하면 그대로 알린다.
 * 조용히 성공했다고 말하면 사용자는 잠금이 풀렸다고 믿고 동기화를 눌렀다가
 * 다시 막힌다.
 */
export function releaseSyncOwner(): ReleaseOwnerResult {
  const localStorage = storage()
  if (localStorage === null) {
    return { ok: false, message: "이 기기의 저장 공간을 쓸 수 없어 연결을 끊지 못했어요." }
  }
  try {
    if (localStorage.getItem(BINDING_KEY) === null) {
      // 이미 풀린 상태 — 실패가 아니다. 같은 결과를 원했고 그 상태다.
      return { ok: true, message: "이 기기는 이미 어떤 계정과도 연결되어 있지 않아요." }
    }
    localStorage.removeItem(BINDING_KEY)
    if (localStorage.getItem(BINDING_KEY) !== null) {
      return {
        ok: false,
        message: "계정 연결을 끊지 못했어요. 일지는 그대로 있어요. "
          + "브라우저의 사이트 데이터 삭제로도 풀 수 있어요.",
      }
    }
    return {
      ok: true,
      message: "이 기기의 계정 연결을 끊었어요. 일지는 그대로 있어요. "
        + "다른 계정으로 로그인해서 동기화를 켤 수 있어요.",
    }
  } catch {
    return { ok: false, message: "계정 연결을 끊지 못했어요. 일지는 그대로 있어요." }
  }
}

export function mergeEntries(
  local: readonly JournalEntry[],
  remote: readonly JournalEntry[],
  deletedIds: ReadonlySet<string> = tombstonedIds(),
): JournalEntry[] {
  const byId = new Map<string, JournalEntry>()
  for (const entry of remote) byId.set(entry.id, entry)
  for (const entry of local) {
    const existing = byId.get(entry.id)
    if (existing === undefined || entry.savedAt >= existing.savedAt) {
      byId.set(entry.id, entry)
    }
  }
  for (const id of deletedIds) byId.delete(id)
  return [...byId.values()].sort((left, right) => (
    left.date === right.date
      ? left.savedAt.localeCompare(right.savedAt)
      : left.date.localeCompare(right.date)
  ))
}

export function toUploadPayload(
  entry: JournalEntry,
  consent: SyncConsent,
): Record<string, unknown> | null {
  if (consent.shareTrainingNotes && entry.memoPurpose === "ANALYZABLE_TRAINING_NOTE") {
    return { ...entry }
  }
  const safe = toExportJournalEntry(entry)
  return safe === null ? null : { ...safe }
}
