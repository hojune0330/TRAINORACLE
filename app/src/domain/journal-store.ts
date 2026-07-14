// journal-store — 로컬 우선(local-first) 일지 저장.
// 원칙 (ACCOUNT_FEDERATION_DECISION.md §3.3):
//  - 일지는 먼저 "이 기기"(localStorage)에 저장된다. 회원가입 없이 완전 동작.
//  - 온라인 보관·다기기 동기화는 계정 연동(F3) 후 syncState "local" → 서버 승격으로 처리.
//  - 통증·메모 등 민감 필드도 기기 밖으로 나가지 않는다 (연동 후에도 TRAINORACLE 백엔드 전용).
// §8 memo_policy: memo/note 자유 입력은 저장만 하고 어떤 판정에도 쓰지 않는다.

export type JournalKind = "post-session" | "evening" | "race"

export interface JournalEntryBase {
  id: string
  kind: JournalKind
  /** YYYY-MM-DD (기기 로컬 기준) */
  date: string
  /** ISO timestamp */
  savedAt: string
  /** local = 이 기기에만 존재. 계정 연동 후 서버 승격되면 "synced" (F3) */
  syncState: "local" | "synced"
}

export interface PostSessionEntry extends JournalEntryBase {
  kind: "post-session"
  system: string
  title: string
  distanceKm: string
  durationMin: string
  avgPace: string
  rpe: number
  memo: string
}

export interface EveningEntry extends JournalEntryBase {
  kind: "evening"
  sleepH: number
  sleepQuality: number
  weightKg: string
  restingHr: string
  painParts: Record<string, number>
  mood: number
  note: string
}

export interface RaceEntry extends JournalEntryBase {
  kind: "race"
  stage: "pre" | "post"
  record: string
  rank: string
  result: string
  memo: string
  // F0-f-6 (R-coach-001): 경기 자기 점검 — 탭하지 않으면 필드 자체를 저장하지 않는다.
  // 근거: RACE_SELFCHECK_FIELDS_DECISION.md (총책임자 스키마 채택 결정).
  // 주의: amendment_v3의 하위호환 메타데이터 조항은 이 필드들의 근거가 아니다 —
  // 이것은 새 도메인 필드이며 별도 결정으로 채택되었다 (PR #60 리뷰 지적 ① 정정).
  // 부재 = 미기록(MISSING 상당). fieldProvenance 메타데이터 채택 시 그 계약을 따른다.
  tension?: number   // 경기 직전 긴장도 1-10 (정수)
  condition?: number // 경기 직전 컨디션 1-5 (정수)
  goalPace?: string  // 경기 직전 목표 페이스·전략 (≤120자)
  mood?: number      // 경기 직후 감정 1-5 (정수)
}

export type JournalEntry = PostSessionEntry | EveningEntry | RaceEntry

const KEY = "trainoracle.journal.v1"

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    const s = window.localStorage
    // Safari 프라이빗 모드 등 쓰기 불가 환경 감지
    const probe = "__to_probe__"
    s.setItem(probe, "1")
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

// F0-f-4 (R-privacy-002): localStorage 변조·구버전 데이터가 무검증으로
// 렌더에 도달하지 않도록 kind별 필수 필드 shape를 수동 검증한다.
// (외부 스키마 라이브러리 미도입 — 번들 최소 원칙)
function isValidEntry(e: unknown): e is JournalEntry {
  if (typeof e !== "object" || e === null) return false
  const o = e as Record<string, unknown>
  if (typeof o.id !== "string" || typeof o.date !== "string" || typeof o.savedAt !== "string") return false
  if (o.syncState !== "local" && o.syncState !== "synced") return false
  if (o.kind === "post-session") {
    return typeof o.system === "string" && typeof o.title === "string" &&
      typeof o.distanceKm === "string" && typeof o.durationMin === "string" &&
      typeof o.avgPace === "string" && typeof o.rpe === "number" && typeof o.memo === "string"
  }
  if (o.kind === "evening") {
    return typeof o.sleepH === "number" && typeof o.sleepQuality === "number" &&
      typeof o.weightKg === "string" && typeof o.restingHr === "string" &&
      typeof o.painParts === "object" && o.painParts !== null &&
      typeof o.mood === "number" && typeof o.note === "string"
  }
  if (o.kind === "race") {
    // 선택 필드: 부재는 허용(MISSING), 존재하면 타입 + 계약 범위 검증
    // (RACE_SELFCHECK_FIELDS_DECISION.md — PR #60 리뷰 지적 ② 반영:
    //  타입만 보면 변조된 범위 밖 값이 정상 데이터로 통과함)
    const optInt = (v: unknown, min: number, max: number) =>
      v === undefined || (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max)
    const optStr = (v: unknown, maxLen: number) =>
      v === undefined || (typeof v === "string" && v.length <= maxLen)
    return (o.stage === "pre" || o.stage === "post") && typeof o.record === "string" &&
      typeof o.rank === "string" && typeof o.result === "string" && typeof o.memo === "string" &&
      optInt(o.tension, 1, 10) && optInt(o.condition, 1, 5) &&
      optStr(o.goalPace, 120) && optInt(o.mood, 1, 5)
  }
  return false
}

export function loadEntries(): JournalEntry[] {
  const s = storage()
  if (!s) return []
  try {
    const raw = s.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const valid = parsed.filter(isValidEntry)
    if (valid.length !== parsed.length && typeof window !== "undefined" && window.location.search.includes("uitest")) {
      console.log(`[JSTORE] dropped=${parsed.length - valid.length}`)
    }
    return valid
  } catch {
    return []
  }
}

export function saveEntry(entry: JournalEntry): { ok: boolean; total: number } {
  // 저장 시점 계약 검증 — UI 버그·프로그래밍 오류로 범위 밖 값이
  // 영속되는 경로를 차단 (읽기 시점 isValidEntry와 동일 계약)
  if (!isValidEntry(entry)) {
    if (typeof window !== "undefined" && window.location.search.includes("uitest")) {
      console.log(`[JSTORE] saveRejected kind=${(entry as { kind?: string }).kind ?? "?"}`)
    }
    return { ok: false, total: loadEntries().length }
  }
  const s = storage()
  const all = loadEntries()
  all.push(entry)
  if (!s) return { ok: false, total: all.length }
  try {
    s.setItem(KEY, JSON.stringify(all))
    return { ok: true, total: all.length }
  } catch {
    return { ok: false, total: all.length }
  }
}

export function entriesForDate(date: string): JournalEntry[] {
  return loadEntries().filter((e) => e.date === date)
}

/** 일지 1건 삭제 — 사용자 명시 확인 후에만 호출할 것 (로컬 데이터 통제권) */
export function deleteEntry(id: string): { ok: boolean; total: number } {
  const s = storage()
  const remain = loadEntries().filter((e) => e.id !== id)
  if (!s) return { ok: false, total: remain.length }
  try {
    s.setItem(KEY, JSON.stringify(remain))
    return { ok: true, total: remain.length }
  } catch {
    return { ok: false, total: remain.length }
  }
}

/**
 * 전체 일지 JSON 문자열 — 내 데이터 내보내기용 (기기 밖 전송 없음, 파일 다운로드만).
 * F0-f-3 (R-privacy-001, 결정 D1): 자유 텍스트(memo/note)는 기본 제외.
 * includeMemo=true를 명시해야 원문 포함 — 호출부가 사용자에게 경고를 보여야 한다.
 */
export function exportEntriesJSON(opts?: { includeMemo?: boolean }): string {
  const includeMemo = opts?.includeMemo === true
  const entries = loadEntries().map((e) => {
    if (includeMemo) return e
    if (e.kind === "evening") return { ...e, note: e.note ? "[제외됨]" : "" }
    return { ...e, memo: e.memo ? "[제외됨]" : "" }
  })
  return JSON.stringify(
    {
      app: "TRAINORACLE",
      format: "trainoracle.journal.v1",
      exportedAt: new Date().toISOString(),
      memoIncluded: includeMemo,
      entries,
    },
    null, 2,
  )
}

/** 최근 저장 순(내림차순) 목록 — 홈 '이 기기의 일지' 섹션용 */
export function recentEntries(limit = 10): JournalEntry[] {
  return loadEntries()
    .slice()
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
    .slice(0, limit)
}

export function localOnlyCount(): number {
  return loadEntries().filter((e) => e.syncState === "local").length
}

export function newEntryId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
}

export function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 저장 후 사용자 안내 문구 — 회원 연동 전/후 공통 소스 (문구 이중정의 금지) */
export const LOCAL_SAVE_NOTICE = "이 기기에 저장됐어요"
export const SYNC_UPSELL_NOTICE = "온라인 보관·기기 이동은 계정 연동 후에 할 수 있어요"

/** ?uitest 전용 — 저장/조회/정리 왕복 자가검증. 콘솔에 [JSTORE] 증거 로그.
 *  opts.seed=true (?uitest=seed): 정리 후 시드 2건을 남겨 홈 '이 기기의 일지' 렌더 증거([HOMEJ]) 확보용. */
export function runStoreSelfTest(opts?: { seed?: boolean }): void {
  const s = storage()
  if (!s) {
    console.log("[JSTORE] storage=unavailable roundtrip=skip")
    return
  }
  const before = loadEntries().length
  const probe: JournalEntry = {
    id: newEntryId(), kind: "post-session", date: todayISO(),
    savedAt: new Date().toISOString(), syncState: "local",
    system: "vo2", title: "__uitest__", distanceKm: "1", durationMin: "1", avgPace: "1'00",
    rpe: 5, memo: "",
  }
  const saved = saveEntry(probe)
  const after = loadEntries()
  const found = after.some((e) => e.id === probe.id)
  // 최근순 조회 검증: 방금 저장한 probe가 recentEntries의 최상단이어야 한다
  const recentTop = recentEntries(1)[0]?.id === probe.id
  // 정리: probe + 이전 시드 제거 (uitest가 실데이터를 남기지 않도록)
  try {
    s.setItem(KEY, JSON.stringify(
      after.filter((e) => e.id !== probe.id && !e.id.startsWith("__uiseed_")),
    ))
  } catch { /* noop */ }
  const restored = loadEntries().length
  let seeded = 0
  if (opts?.seed) {
    const now = Date.now()
    const seeds: JournalEntry[] = [
      {
        id: "__uiseed_1__", kind: "post-session", date: todayISO(),
        savedAt: new Date(now - 1000).toISOString(), syncState: "local",
        system: "lt", title: "시드 · 템포런", distanceKm: "8", durationMin: "40", avgPace: "5'00",
        rpe: 6, memo: "",
      },
      {
        id: "__uiseed_2__", kind: "evening", date: todayISO(),
        savedAt: new Date(now).toISOString(), syncState: "local",
        sleepH: 7.5, sleepQuality: 4, weightKg: "62.0", restingHr: "48",
        painParts: { "왼 무릎": 4 }, mood: 4, note: "시드 · 컨디션 좋음",
      },
    ]
    for (const e of seeds) saveEntry(e)
    seeded = seeds.length
  }
  // 계약 범위 검증 프로브: 범위 밖 race 자기 점검 값은 저장이 거부되어야 한다
  // (RACE_SELFCHECK_FIELDS_DECISION.md §3 — PR #60 리뷰 지적 ② 증거)
  const badProbe = {
    id: newEntryId(), kind: "race", date: todayISO(),
    savedAt: new Date().toISOString(), syncState: "local",
    stage: "pre", record: "", rank: "", result: "", memo: "",
    tension: 999,
  } as unknown as JournalEntry
  const rangeRejected = !saveEntry(badProbe).ok && !loadEntries().some((e) => e.id === badProbe.id)
  console.log(
    `[JSTORE] roundtrip=${saved.ok && found} recentTop=${recentTop} rangeRejected=${rangeRejected} before=${before} afterSave=${after.length} afterClean=${restored} seeded=${seeded}`,
  )
}
