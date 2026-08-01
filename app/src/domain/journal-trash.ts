// 휴지통 — 실수로 지운 일지를 30일 동안 되돌릴 수 있게 한다.
//
// 왜 만들었는가 (결정 경위):
//  기존 동작은 "지우면 즉시 사라짐"이었다. 검토 단계에서 나는 "삭제는 삭제여야
//  한다"는 이유로 즉시 삭제 유지를 권했다. 소유자가 **휴지통 30일**로 결정했고,
//  그 결정을 그대로 구현한다. 판단 근거를 남겨 둔다: 일지는 손으로 쓴 기록이라
//  다시 만들 수 없고, 오타 한 번으로 몇 달 기록이 사라지는 위험이 "지웠는데 왜
//  아직 있냐"는 위험보다 크다고 본 것이다.
//
// 설계 원칙 (여기서 지켜야 하는 것들):
//  - **삭제 자체는 즉시다.** 일지 목록·분석·백업·동기화 어디에서도 휴지통 항목은
//    보이지 않는다. 휴지통은 별도 키에 따로 보관되며, `loadEntries()`가 읽는
//    본문 키에는 남지 않는다. 즉 "지운 것처럼 보이는데 실은 남아 있는" 상태가
//    아니라, "지웠고 30일간 복구 창구가 열려 있는" 상태다.
//  - **tombstone은 그대로 기록한다.** 휴지통이 있어도 삭제 기록은 남는다.
//    남기지 않으면 계정 동기화 사용자에게 서버 사본이 되살아난다(F-2 결함).
//  - **되돌리기는 새 id로 넣는다.** 원래 id로 되살리면 서버에 이미 올라간
//    삭제 기록과 정면으로 충돌한다: 로컬 tombstone을 지워도 다음 동기화에서
//    서버 tombstone이 다시 내려와 복구한 일지를 또 지운다. 반대로 tombstone을
//    지우면서 서버 사본이 아직 살아 있으면 중복이 생긴다. 새 id를 쓰면 두 문제가
//    동시에 사라진다 — 오래된 id는 계속 "지워진 id"로 남고, 복구본은 새 기록으로
//    올라간다. 사용자가 보는 내용(날짜·수치·메모)은 완전히 같다.
//    (id 교체는 journal-store의 `restoreDeletedEntry`가 담당한다.)
//  - **보관 기간은 읽을 때 정리한다.** 백그라운드 작업이 없는 정적 앱이므로,
//    30일이 지난 항목은 휴지통을 읽는 순간 사라진다. 앱을 몇 달 안 켜도
//    다음 실행 때 즉시 정리된다.
//  - **개수 상한을 둔다.** 휴지통에는 메모 원문까지 든 일지 전체가 들어가므로
//    localStorage 한도(보통 5 MB)를 잡아먹을 수 있다. 초과분은 오래된 것부터
//    버린다 — 이미 사용자가 지운 기록이므로 잃어도 되는 쪽이다.
//  - **실패를 숨기지 않는다.** 휴지통에 넣지 못했으면 그 사실을 돌려준다.
//    "되돌릴 수 있어요"라고 안내한 뒤 못 되돌리는 것이 가장 나쁘다.

import { parseJournalEntryForWrite } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"
import { parsePrivateMemoRecord } from "./private-memo-vault"
import type { PrivateMemoRecord } from "./private-memo-vault"

const KEY = "trainoracle.journal.trash.v1"

/** 보관 기간 — 소유자 결정: 30일 */
export const TRASH_RETENTION_DAYS = 30

/**
 * 보관 개수 상한. 일지 1건이 메모 포함 최대 ~2 KB라고 보면 200건은 약 400 KB로,
 * localStorage 한도(보통 5 MB) 안에서 안전하다. 30일 안에 200건을 지우는
 * 사용은 사실상 없다.
 */
export const TRASH_LIMIT = 200

export type TrashedEntry = {
  /** 지워진 일지 원본 — 메모 원문까지 그대로 보관한다(되돌리기 위해) */
  readonly entry: JournalEntry
  /** 지운 시각 ISO — 남은 기간 계산 기준 */
  readonly deletedAt: string
  readonly privateMemo?: PrivateMemoRecord
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage
  } catch {
    return null
  }
}

function isExpired(deletedAt: string, now: number): boolean {
  const deletedMs = Date.parse(deletedAt)
  // 시각을 못 읽으면 만료로 보지 않는다 — 못 읽었다는 이유로 복구 창구를
  // 닫아버리면 사용자가 잃는 쪽이 크다.
  if (Number.isNaN(deletedMs)) return false
  return now - deletedMs > TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
}

function parseTrashed(value: unknown): TrashedEntry | null {
  if (typeof value !== "object" || value === null) return null
  const record = value as Record<string, unknown>
  if (typeof record.deletedAt !== "string" || record.deletedAt === "") return null
  const entry = parseJournalEntryForWrite(record.entry)
  if (entry === null) return null
  if (record.privateMemo === undefined) return { entry, deletedAt: record.deletedAt }
  const privateMemo = parsePrivateMemoRecord(record.privateMemo)
  return privateMemo === null ? null : { entry, deletedAt: record.deletedAt, privateMemo }
}

function write(items: readonly TrashedEntry[]): boolean {
  const localStorage = storage()
  if (localStorage === null) return false
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
    return true
  } catch {
    return false
  }
}

/**
 * 휴지통 읽기. 깨진 항목과 30일이 지난 항목은 결과에서 빠진다.
 * 최근에 지운 것이 먼저 온다.
 */
export function loadTrash(now: number = Date.now()): TrashedEntry[] {
  const localStorage = storage()
  if (localStorage === null) return []
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const items: TrashedEntry[] = []
    for (const candidate of parsed) {
      const item = parseTrashed(candidate)
      if (item === null) continue
      if (isExpired(item.deletedAt, now)) continue
      items.push(item)
    }
    return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  } catch {
    return []
  }
}

/**
 * 만료·손상 항목을 저장소에서도 실제로 지운다.
 * `loadTrash`는 읽을 때 걸러내기만 하므로, 자리를 비우려면 이걸 호출해야 한다.
 * 앱 시작 시 한 번 부르는 것으로 충분하다.
 */
export function purgeExpiredTrash(now: number = Date.now()): number {
  const localStorage = storage()
  if (localStorage === null) return 0
  const raw = localStorage.getItem(KEY)
  if (raw === null) return 0
  const kept = loadTrash(now)
  const before = (() => {
    try {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.length : 0
    } catch {
      return 0
    }
  })()
  if (before === kept.length) return 0
  write(kept)
  return before - kept.length
}

/**
 * 지운 일지를 휴지통에 넣는다.
 * 같은 id가 이미 있으면 최신 것으로 교체한다(중복 보관 방지).
 */
export function moveToTrash(
  entry: JournalEntry,
  deletedAt: string = new Date().toISOString(),
  privateMemo?: PrivateMemoRecord,
): boolean {
  const existing = loadTrash().filter((item) => item.entry.id !== entry.id)
  const item = privateMemo === undefined ? { entry, deletedAt } : { entry, deletedAt, privateMemo }
  const next = [...existing, item]
    .sort((a, b) => a.deletedAt.localeCompare(b.deletedAt))
  const trimmed = next.length > TRASH_LIMIT ? next.slice(next.length - TRASH_LIMIT) : next
  return write(trimmed)
}

/**
 * 휴지통에서 꺼낸다 — 꺼낸 항목은 휴지통에서 사라진다.
 * 되돌리기의 앞단계이며, 실제 일지 복구는 journal-store가 한다.
 * 저장에 실패하면 null을 돌려준다 — 꺼낸 척하고 휴지통에 남겨 두면
 * 되돌리기를 두 번 눌러 일지가 두 개 생긴다.
 */
export function takeFromTrash(id: string): TrashedEntry | null {
  const items = loadTrash()
  const found = items.find((item) => item.entry.id === id)
  if (found === undefined) return null
  if (!write(items.filter((item) => item.entry.id !== id))) return null
  return found
}

/** 휴지통에서 완전히 지운다 — 되돌릴 수 없다 */
export function dropFromTrash(id: string): boolean {
  const items = loadTrash()
  if (!items.some((item) => item.entry.id === id)) return false
  return write(items.filter((item) => item.entry.id !== id))
}

/** 휴지통 비우기 */
export function emptyTrash(): boolean {
  return write([])
}

/** 남은 보관 일수 — 0이면 오늘 지나면 사라진다 */
export function daysLeftInTrash(deletedAt: string, now: number = Date.now()): number {
  const deletedMs = Date.parse(deletedAt)
  if (Number.isNaN(deletedMs)) return TRASH_RETENTION_DAYS
  const elapsedDays = Math.floor((now - deletedMs) / (24 * 60 * 60 * 1000))
  return Math.max(0, TRASH_RETENTION_DAYS - elapsedDays)
}
