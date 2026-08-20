// 이 기기의 내 데이터 전부 지우기.
//
// 왜 필요한가:
//  지금까지는 일지를 **한 개씩만** 지울 수 있었다. "이 앱 그만 쓸래",
//  "기기를 넘겨줄 건데 기록을 남기고 싶지 않아" 같은 상황에서 사용자가
//  할 수 있는 일이 없었다. 삭제권은 개별 삭제만으로 완성되지 않는다.
//  (브라우저 설정으로 지우는 방법은 있지만, 사용자에게 "브라우저 설정에
//   들어가서 사이트 데이터를 찾아 지우세요"라고 요구하는 건 삭제권 제공이 아니다.)
//
// 설계 원칙:
//  - **tombstone은 남긴다.** 전부 지운 뒤 동기화하면 서버 사본이 되살아나기
//    때문이다. "지웠다는 사실"이 없으면 삭제가 무효가 된다. tombstone에는
//    id와 시각만 있고 본문·날짜·수치가 없으므로 남겨도 내용이 남지 않는다.
//  - 다만 tombstone도 지우는 선택지를 따로 둔다(`includeDeletionRecord`).
//    기기를 완전히 넘길 때는 "무엇을 지웠는지"의 흔적조차 원치 않을 수 있다.
//    이 경우 서버 부활 위험을 사용자가 감수하는 것이므로 UI에서 설명해야 한다.
//  - 로그인 토큰도 지운다. 기기를 넘기는데 계정이 남아 있으면 안 된다.
//  - 실패를 숨기지 않는다. 지워진 키와 실패한 키를 그대로 돌려준다.
import { ATHLETE_RECORDS_STORAGE_KEY } from "./athlete-records"
import { DECORATION_STORAGE_KEY_V1, DECORATION_STORAGE_KEY_V2 } from "./decorations"
import { ENGAGEMENT_STORAGE_KEY } from "./engagement"
import {
  PRIVATE_MEMO_VAULT_STORAGE_KEY,
  PRIVATE_NOTE_RECOVERY_STORAGE_KEY,
  SYNC_RECOVERY_STORAGE_KEY,
} from "./journal-storage-keys"

/** 일지 본문이 담기는 키 — 반드시 지운다 */
const CONTENT_KEYS = [
  "trainoracle.journal.v1",
  // 휴지통에는 **지운 일지 원본이 메모 원문까지 그대로** 들어 있다. 여기를
  // 빼놓으면 "이 기기의 내 데이터 전부 지우기"가 거짓말이 된다 — 지운 일지가
  // 30일 동안 기기에 남는다. 기기를 넘기는 상황에서 가장 위험한 누락이다.
  "trainoracle.journal.trash.v1",
  "trainoracle.journal.full-backup.v1",
  DECORATION_STORAGE_KEY_V1,
  DECORATION_STORAGE_KEY_V2,
  SYNC_RECOVERY_STORAGE_KEY,
  PRIVATE_MEMO_VAULT_STORAGE_KEY,
  ATHLETE_RECORDS_STORAGE_KEY,
  "trainoracle.plan-beta.v1",
  "trainoracle.plan-beta.history.v1",
  "trainoracle.plan-beta.previous-intake.v1",
  "trainoracle.plan-beta.adaptation.v1",
  "trainoracle.plan-adaptation-context.v1",
  "trainoracle.engagement.v1",
  ENGAGEMENT_STORAGE_KEY,
  "trainoracle.onboarding.dismissed.v1",
] as const

const SESSION_KEYS = [PRIVATE_NOTE_RECOVERY_STORAGE_KEY] as const

/** 계정·동기화 관련 키 — 기기를 넘길 때 남으면 안 된다 */
const ACCOUNT_KEYS = [
  "trainoracle.auth.v1",
  "trainoracle.sync.consent.v1",
  // 이 키에는 **계정 userId가 평문으로** 들어 있다(`sync.ts`의 claimSyncOwner).
  // 원래는 삭제 기록과 한 묶음으로 다뤄 기본 삭제에서 빠져 있었는데, 그 묶음의
  // 근거는 "지웠다는 사실이 없으면 서버 사본이 되살아난다"였다. 그 근거는
  // tombstone에만 해당한다 — owner 키는 부활을 막는 데 아무 역할이 없다.
  // 남겨 두면 두 가지가 깨진다.
  //  1) 화면은 "일지·계획·로그인 정보를 모두 지워요"라고 말한다. userId가
  //     남으면 그 문장이 거짓이 된다(A-1).
  //  2) claimSyncOwner는 owner 키가 있으면 다른 userId의 동기화를 영구히
  //     막는다. 기기를 넘겨받은 사람은 전부 지웠는데도 자기 계정으로
  //     동기화할 수 없고, 화면에는 이를 푸는 방법이 없다(A-2).
  // tombstone은 그대로 남긴다 — 부활 방지 근거가 실제로 적용되는 유일한 키다.
  "trainoracle.sync.owner.v1",
] as const

/** 삭제 기록 — 기본은 **남긴다**(서버 부활 방지) */
const DELETION_RECORD_KEY = "trainoracle.sync.tombstones.v1"

export type EraseOptions = {
  /**
   * 삭제 기록(tombstone)까지 지울지. 기본 false.
   * true면 흔적이 완전히 사라지지만, 계정 동기화를 쓰던 경우
   * 서버 사본이 되살아날 수 있다.
   */
  readonly includeDeletionRecord?: boolean
}

export type EraseResult = {
  readonly ok: boolean
  /** 실제로 지운 키 개수 */
  readonly cleared: number
  /** 지우지 못한 키 — 비어 있어야 정상 */
  readonly failed: readonly string[]
}

function storage(kind: "local" | "session"): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return kind === "local" ? window.localStorage : window.sessionStorage
  } catch (error) {
    if (error instanceof Error) return null
    throw error
  }
}

function clearStorageKeys(
  target: Storage,
  keys: readonly string[],
  failed: string[],
): number {
  let cleared = 0
  for (const key of keys) {
    try {
      const existed = target.getItem(key) !== null
      target.removeItem(key)
      if (target.getItem(key) !== null) {
        failed.push(key)
        continue
      }
      if (existed) cleared += 1
    } catch (error) {
      if (error instanceof Error) failed.push(key)
      else throw error
    }
  }
  return cleared
}

/**
 * 이 기기에 저장된 내 데이터를 지운다.
 * 서버에 올라간 사본은 지우지 않는다 — 그건 동기화(삭제 전파)의 몫이다.
 */
export function eraseAllLocalData(options: EraseOptions = {}): EraseResult {
  const localStorage = storage("local")
  if (localStorage === null) return { ok: false, cleared: 0, failed: ["storage-unavailable"] }

  const keys: string[] = [...CONTENT_KEYS, ...ACCOUNT_KEYS]
  if (options.includeDeletionRecord === true) {
    keys.push(DELETION_RECORD_KEY)
  }

  const failed: string[] = []
  let cleared = clearStorageKeys(localStorage, keys, failed)
  const sessionStorage = storage("session")
  if (sessionStorage === null) {
    failed.push("session-storage-unavailable")
  } else {
    cleared += clearStorageKeys(sessionStorage, SESSION_KEYS, failed)
  }

  return { ok: failed.length === 0, cleared, failed }
}

/** 지워질 대상 키 목록 — UI에서 "무엇이 지워지는지" 보여줄 때 쓴다 */
export function erasableKeys(options: EraseOptions = {}): readonly string[] {
  const keys: string[] = [...CONTENT_KEYS, ...ACCOUNT_KEYS, ...SESSION_KEYS]
  if (options.includeDeletionRecord === true) {
    keys.push(DELETION_RECORD_KEY)
  }
  return keys
}
