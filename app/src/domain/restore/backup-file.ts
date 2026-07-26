// 백업 파일 복원 — 내보낸 JSON을 다시 일지로 되돌린다.
//
// 왜 이게 필요한가 (실제 공백):
//  앱은 "내 일지 데이터 내려받기(JSON)"와 "메모 포함 파일 내보내기(JSON)"를
//  제공하고, 안내에도 "이 기기에만 저장" · "계정 연동으로 지키기"라고 쓴다.
//  그런데 **내보낸 파일을 되돌리는 경로가 없었다.** 즉 사용자가 백업을
//  받아둬도 브라우저 데이터를 지우거나 기기를 바꾸면 그 파일은 쓸 데가 없다.
//  백업을 권하면서 복원을 안 주는 것은 지키지 못할 약속이다.
//
// 원칙:
//  - 파일은 이 기기에서만 읽는다. 어디로도 업로드하지 않는다.
//  - **덮어쓰기 없음(기본)**: 기존 일지를 지우지 않고 합친다. 같은 id가 있으면
//    사용자에게 선택을 남기고, 기본은 "기존 것 유지"다. 백업 복원이 지금
//    데이터를 날리는 사고를 원천 차단한다.
//  - **지운 일지는 복원되지 않는다**: tombstone에 있는 id는 건너뛴다. 지운
//    기록이 백업 파일을 통해 돌아오면 삭제권 위반이다(동기화와 같은 규칙).
//  - fail-visible: 읽지 못한 항목 수를 숨기지 않는다.
//  - 저장은 기존 쓰기 검증(parseJournalEntryForWrite)을 그대로 통과해야 한다.
//    검증을 우회하는 복원 경로를 만들지 않는다.
import { tombstonedIds } from "../account/tombstone"
import { parseJournalEntryForWrite, parseJournalEntryList } from "../journal-schema"
import type { JournalEntry } from "../journal-schema"
import { loadEntries, replaceAllEntries, saveEntry } from "../journal-store"

/** 인식하는 내보내기 형식 — journal-store.exportEntriesJSON이 쓰는 값들 */
export const SAFE_FORMAT = "trainoracle.journal.v1"
export const FULL_FORMAT = "trainoracle.journal.full-backup.v1"

export type BackupKind = "safe" | "full"

export type BackupReadResult = {
  /** 스키마 검증을 통과한 항목 */
  readonly entries: readonly JournalEntry[]
  /** 형식이 어긋나 건너뛴 항목 수 — 숨기지 않고 보여준다 */
  readonly skipped: number
  /** 메모 포함 백업인지 — 화면 안내 문구가 달라진다 */
  readonly kind: BackupKind
  /** 파일 자체를 백업으로 인식하지 못한 경우 */
  readonly recognized: boolean
  /** 파일에 적힌 내보낸 시각 (있으면 표시용) */
  readonly exportedAt: string | null
}

const UNRECOGNIZED: BackupReadResult = {
  entries: [], skipped: 0, kind: "safe", recognized: false, exportedAt: null,
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * 백업 JSON 문자열 읽기. 형식을 인식하지 못하면 recognized:false로 돌려주고
 * 절대 추측해서 복원하지 않는다.
 */
export function readBackupFile(text: string): BackupReadResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return UNRECOGNIZED
  }

  const root = asRecord(parsed)
  if (root === null) return UNRECOGNIZED
  if (root.app !== "TRAINORACLE") return UNRECOGNIZED

  const format = root.format
  const kind: BackupKind | null = format === FULL_FORMAT
    ? "full"
    : format === SAFE_FORMAT ? "safe" : null
  if (kind === null) return UNRECOGNIZED

  const rawEntries = root.entries
  if (!Array.isArray(rawEntries)) return { ...UNRECOGNIZED, recognized: true, kind }

  const prepared = kind === "safe" ? rawEntries.map(withEmptyTextFields) : rawEntries
  const entries = parseJournalEntryList(prepared)
  return {
    entries,
    skipped: rawEntries.length - entries.length,
    kind,
    recognized: true,
    exportedAt: typeof root.exportedAt === "string" ? root.exportedAt : null,
  }
}

/**
 * 안전 백업(메모 제외)을 복원 가능하게 만든다.
 *
 * 안전 내보내기는 `memo` / `note` / `memoPurpose`를 **일부러 제거**한다. 그런데
 * 일지 스키마는 `memo`(또는 `note`)를 필수로 요구한다. 그래서 안전 백업
 * 파일은 그대로는 스키마 검증을 통과하지 못하고, 복원이 **전부 실패**했다.
 * 앱이 첫 번째로 권하는 백업 파일이 되돌릴 수 없는 파일이었던 셈이다.
 *
 * 여기서 하는 일은 "빠진 텍스트 자리를 빈 문자열로 되돌리는 것"뿐이다.
 * 파일에 메모가 없으니 복원된 일지의 메모도 비어 있다 — 없는 내용을 만들어
 * 채우지 않는다. 숫자·날짜·강도 같은 값은 절대 손대지 않는다. 이미 값이 있는
 * 필드도 덮어쓰지 않는다.
 */
function withEmptyTextFields(raw: unknown): unknown {
  const record = asRecord(raw)
  if (record === null) return raw
  const textField = record.kind === "evening" ? "note" : "memo"
  if (typeof record[textField] === "string") return raw
  return { ...record, [textField]: "" }
}

export type RestorePlanItem = {
  readonly entry: JournalEntry
  /** 같은 id의 일지가 이미 이 기기에 있다 */
  readonly conflictsWithExisting: boolean
  /** 사용자가 지운 id — 복원 대상에서 제외된다 */
  readonly previouslyDeleted: boolean
}

export type RestorePlan = {
  readonly items: readonly RestorePlanItem[]
  /** 지운 적 있어서 복원하지 않을 개수 */
  readonly blockedByDeletion: number
  /** 이미 있는 일지와 id가 겹치는 개수 */
  readonly conflicts: number
  /** 겹치지도, 지운 적도 없는 새 항목 개수 */
  readonly fresh: number
}

/**
 * 복원 계획 세우기 — 무엇이 새로 들어오고, 무엇이 겹치고, 무엇이 제외되는지
 * 저장 전에 사용자에게 그대로 보여주기 위한 순수 함수.
 */
export function buildRestorePlan(
  entries: readonly JournalEntry[],
  existing: readonly JournalEntry[] = loadEntries(),
  deletedIds: ReadonlySet<string> = tombstonedIds(),
): RestorePlan {
  const existingIds = new Set(existing.map((entry) => entry.id))
  const items = entries.map((entry) => ({
    entry,
    conflictsWithExisting: existingIds.has(entry.id),
    previouslyDeleted: deletedIds.has(entry.id),
  }))
  return {
    items,
    blockedByDeletion: items.filter((item) => item.previouslyDeleted).length,
    conflicts: items.filter((item) => !item.previouslyDeleted && item.conflictsWithExisting).length,
    fresh: items.filter((item) => !item.previouslyDeleted && !item.conflictsWithExisting).length,
  }
}

export type RestoreMode =
  /** 겹치는 항목은 건드리지 않는다 (기본 — 지금 데이터를 지키는 쪽) */
  | "keep-existing"
  /** 겹치는 항목을 백업 파일 내용으로 바꾼다 (사용자가 명시적으로 선택) */
  | "overwrite-conflicts"

export type RestoreOutcome = {
  readonly restored: number
  /** 기존 것을 지키기로 해서 건너뛴 개수 */
  readonly keptExisting: number
  /** 지운 적 있어서 제외한 개수 */
  readonly blockedByDeletion: number
  /** 쓰기 검증을 통과하지 못해 저장하지 못한 개수 */
  readonly failed: number
  readonly total: number
}

/**
 * 실제 복원.
 *
 * 검증은 기존 쓰기 경로와 동일한 규칙을 쓴다 — 복원이라고 해서 스키마 검증을
 * 우회하지 않는다. 겹치는 항목을 바꿀 때는 append가 아니라 교체여야 하므로
 * (그렇지 않으면 같은 id가 두 개 생긴다) 검증 통과분으로 목록을 재구성한다.
 * 어떤 실패에서도 이미 있던 일지는 지워지지 않는다.
 */
export function restoreEntries(
  plan: RestorePlan,
  mode: RestoreMode = "keep-existing",
): RestoreOutcome {
  let restored = 0
  let keptExisting = 0
  let failed = 0
  const replacements = new Map<string, JournalEntry>()

  for (const item of plan.items) {
    if (item.previouslyDeleted) continue

    if (item.conflictsWithExisting && mode === "keep-existing") {
      keptExisting += 1
      continue
    }

    // 복원한 일지는 이 기기 소유로 되돌린다 — 서버 상태를 가정하지 않는다.
    //
    // 출처(fieldProvenance)는 파일 값을 그대로 보존한다. 손댄 파일이 EXPLICIT을
    // 주장할 수 있다는 점은 검토했고, 강등하지 않기로 했다:
    //  - 위협 모델상 공격자는 곧 사용자 본인이다. 자기 기기의 자기 통계이고,
    //    같은 값을 화면에 직접 입력하면 어차피 EXPLICIT이 된다. 강등은
    //    막을 수 없는 것을 막는 시늉이다.
    //  - 반면 강등하면 **정상 사용자**의 백업 복원 시 통계가 조용히 비어버린다.
    //    실제 피해가 확실한 쪽은 이쪽이다.
    // 남이 보낸 파일을 받아 넣는 경로가 생기면 이 판단은 다시 해야 한다.
    const candidate = parseJournalEntryForWrite({ ...item.entry, syncState: "local" })
    if (candidate === null) {
      failed += 1
      continue
    }

    if (item.conflictsWithExisting) {
      // 교체 — append하면 같은 id가 두 개 남는다.
      replacements.set(candidate.id, candidate)
      restored += 1
      continue
    }

    const result = saveEntry(candidate)
    if (result.ok) restored += 1
    else failed += 1
  }

  if (replacements.size > 0) {
    const next = loadEntries().map((entry) => replacements.get(entry.id) ?? entry)
    const written = replaceAllEntries(next)
    if (!written.ok) {
      // 교체 실패 — 기존 일지는 그대로다. 교체 시도분만 실패로 센다.
      failed += replacements.size
      restored -= replacements.size
    }
  }

  return {
    restored,
    keptExisting,
    blockedByDeletion: plan.blockedByDeletion,
    failed,
    total: plan.items.length,
  }
}
