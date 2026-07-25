// 삭제 기록(tombstone) — "지운 일지는 되살아나지 않는다"를 보장한다.
//
// 왜 필요한가 (실제 결함):
//  기존 동기화는 id 기준 LWW 머지만 했다. 그래서 이런 일이 벌어졌다.
//   1. 기기A에서 일지를 쓰고 동기화 → 서버에 사본이 생긴다
//   2. 사용자가 기기A에서 그 일지를 삭제한다 → 로컬에서 사라진다
//   3. 다시 동기화 → 서버 사본이 pull되고, 로컬에는 없으니 "한쪽에만 있는
//      항목"으로 판정되어 **되살아난다**
//  사용자가 지운 기록이 말없이 돌아오는 것은 삭제권 위반이다. 특히 통증·감정
//  메모처럼 "지우고 싶어서 지운" 기록이 돌아오면 신뢰가 깨진다.
//
// 설계 원칙:
//  - 삭제는 되살아나지 않는다. tombstone은 머지에서 항상 이긴다(LWW 예외).
//    삭제 후 같은 id를 되살리려면 새 일지를 쓰면 된다(새 id를 받으므로 안전).
//  - tombstone에는 **id와 삭제 시각만** 담는다. 날짜·메모·수치는 담지 않는다.
//    "무엇을 지웠는지"가 아니라 "이 id는 지워졌다"만 기록한다(최소 수집).
//  - 로컬 전용 기록이며, 서버로 보내는 것은 후속 단계다(§tombstone 전파).
//    지금 단계에서도 같은 기기에서의 부활은 완전히 막힌다.
//  - 상한을 둔다: 오래된 tombstone은 잘라낸다. 무한 증가는 저장 공간을
//    잡아먹고, 아주 오래 전 삭제분이 서버에 남아 있을 가능성은 낮다.

const KEY = "trainoracle.sync.tombstones.v1"

/** 보관 상한 — 최근 삭제분 우선 (초과분은 오래된 것부터 잘라낸다) */
export const TOMBSTONE_LIMIT = 500

export type Tombstone = {
  /** 삭제된 일지 id */
  readonly id: string
  /** 삭제 시각 ISO — 머지 판정과 정리에 쓴다 */
  readonly deletedAt: string
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage
  } catch {
    return null
  }
}

function isTombstone(value: unknown): value is Tombstone {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === "string" && record.id !== ""
    && typeof record.deletedAt === "string" && record.deletedAt !== ""
}

/** 저장된 삭제 기록 — 깨진 값은 조용히 버린다(fail-safe) */
export function loadTombstones(): Tombstone[] {
  const localStorage = storage()
  if (localStorage === null) return []
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isTombstone)
  } catch {
    return []
  }
}

function write(tombstones: readonly Tombstone[]): boolean {
  const localStorage = storage()
  if (localStorage === null) return false
  try {
    localStorage.setItem(KEY, JSON.stringify(tombstones))
    return true
  } catch {
    return false
  }
}

/**
 * 삭제 기록 추가. 같은 id가 이미 있으면 더 최근 시각으로 갱신한다.
 * 상한(TOMBSTONE_LIMIT)을 넘으면 오래된 것부터 잘라낸다.
 */
export function recordTombstone(id: string, deletedAt: string = new Date().toISOString()): boolean {
  if (id === "") return false
  const existing = loadTombstones().filter((tombstone) => tombstone.id !== id)
  const next = [...existing, { id, deletedAt }]
    .sort((a, b) => a.deletedAt.localeCompare(b.deletedAt))
  const trimmed = next.length > TOMBSTONE_LIMIT ? next.slice(next.length - TOMBSTONE_LIMIT) : next
  return write(trimmed)
}

/** 삭제된 id 집합 — 머지에서 빠르게 조회하기 위한 형태 */
export function tombstonedIds(tombstones: readonly Tombstone[] = loadTombstones()): ReadonlySet<string> {
  return new Set(tombstones.map((tombstone) => tombstone.id))
}

/**
 * 삭제 기록 정리 — 서버에서도 확실히 사라진 뒤에는 보관할 이유가 없다.
 * 지금은 상한 관리용으로만 쓰고, 서버 전파가 붙으면 확인된 항목을 지운다.
 */
export function clearTombstones(): boolean {
  return write([])
}
