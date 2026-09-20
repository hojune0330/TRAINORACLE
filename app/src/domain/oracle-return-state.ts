import { accountAuthState } from "./account/account-auth-state"
import { accountFeatureEnabled } from "./account/config"
import { activeLocalAccount, onLocalJournalScopeChange } from "./account/local-journal-ownership"
import { isOracleTopicId, type OracleTopicId } from "./oracle-exploration"

/**
 * Return-state is a deliberately small, local-only projection. It stores no
 * journal text, health values, timestamps, or source records. Fingerprints
 * are opaque values computed by the caller from approved structured output.
 */
export type OracleReturnScope =
  | { readonly kind: "account"; readonly id: string }
  | { readonly kind: "guest" }
  | { readonly kind: "unresolved" }

export type OracleParticipationAction = "journal-saved" | "plan-reviewed" | "rest-recorded"
export type OracleWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type OracleReturnState = {
  readonly schemaVersion: 1
  readonly optedIn: boolean
  readonly savedTopicIds: readonly OracleTopicId[]
  readonly lastSelectedTopicId: OracleTopicId | null
  readonly lastSeenAnalysisFingerprints: Readonly<Partial<Record<OracleTopicId, string>>>
  readonly selectedWeekdays: readonly OracleWeekday[]
  readonly participationByDate: Readonly<Record<string, OracleParticipationAction>>
}

export type OracleReturnRead = {
  readonly status: "ready" | "unresolved" | "unavailable" | "corrupt"
  readonly scope: OracleReturnScope
  readonly state: OracleReturnState
}

export type OracleReturnMutation =
  | { readonly ok: true; readonly state: OracleReturnState }
  | { readonly ok: false; readonly code: "SCOPE_UNAVAILABLE" | "STORAGE_UNAVAILABLE" | "INVALID_STORAGE" | "OPT_IN_REQUIRED" | "INVALID_TOPIC" | "INVALID_FINGERPRINT" | "INVALID_WEEKDAY" | "INVALID_DATE" | "FUTURE_DATE" | "INVALID_ACTION" | "ALREADY_RECORDED" | "NO_DAYS_SELECTED" }

export type OracleReturnErrorCode = Exclude<OracleReturnMutation, { readonly ok: true }>["code"]

const STORAGE_PREFIX = "trainoracle.oracle-return.v1:"
export const ORACLE_RETURN_STATE_EVENT = "trainoracle:oracle-return-state-changed"
const ACTIONS: readonly OracleParticipationAction[] = ["journal-saved", "plan-reviewed", "rest-recorded"]
const WEEKDAYS: readonly OracleWeekday[] = [0, 1, 2, 3, 4, 5, 6]

function defaultState(): OracleReturnState {
  return {
    schemaVersion: 1,
    optedIn: false,
    savedTopicIds: [],
    lastSelectedTopicId: null,
    lastSeenAnalysisFingerprints: {},
    selectedWeekdays: [],
    participationByDate: {},
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function validFingerprint(value: unknown): value is string {
  // The caller supplies a non-reversible change token, never source material.
  // Hex-only validation keeps accidental memo/health text out of local storage.
  return typeof value === "string" && /^(?:[a-f0-9]{8,64})$/u.test(value)
}

function validAction(value: unknown): value is OracleParticipationAction {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value)
}

function parseDateKey(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null
  const parts = value.split("-").map(Number)
  const year = parts[0]
  const month = parts[1]
  const day = parts[2]
  if (year === undefined || month === undefined || day === undefined) return null
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

export function localOracleDateKey(date = new Date()): string {
  const year = date.getFullYear().toString().padStart(4, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

function compareDateKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function addDays(dateKey: string, amount: number): string {
  const date = parseDateKey(dateKey) ?? new Date()
  date.setDate(date.getDate() + amount)
  return localOracleDateKey(date)
}

function weekday(dateKey: string): OracleWeekday {
  return (parseDateKey(dateKey)?.getDay() ?? 0) as OracleWeekday
}

function scopeForCurrentUser(): OracleReturnScope {
  const accountId = activeLocalAccount()
  if (typeof accountId === "string" && accountId.length > 0) return { kind: "account", id: accountId }
  // A local-only build explicitly resolves to the device guest scope. An
  // enabled account build must not turn auth failure into a guest scope.
  if (!accountFeatureEnabled()) return { kind: "guest" }
  return accountAuthState() === "GUEST" ? { kind: "guest" } : { kind: "unresolved" }
}

export function currentOracleReturnScope(): OracleReturnScope {
  return scopeForCurrentUser()
}

function storageKey(scope: OracleReturnScope): string | null {
  if (scope.kind === "unresolved") return null
  if (scope.kind === "guest") return `${STORAGE_PREFIX}guest`
  return `${STORAGE_PREFIX}account:${encodeURIComponent(scope.id)}`
}

function parseState(value: unknown, today: string): OracleReturnState | null {
  if (typeof value !== "object" || value === null) return null
  const record = value as Record<string, unknown>
  if (record.schemaVersion !== 1 || typeof record.optedIn !== "boolean") return null
  if (!Array.isArray(record.savedTopicIds) || record.savedTopicIds.length > 6
    || record.savedTopicIds.some((id) => !isOracleTopicId(id))) return null
  const savedTopicIds = [...new Set(record.savedTopicIds)] as OracleTopicId[]
  if (record.lastSelectedTopicId !== null && !isOracleTopicId(record.lastSelectedTopicId)) return null

  const lastSeen = record.lastSeenAnalysisFingerprints
  if (typeof lastSeen !== "object" || lastSeen === null || Array.isArray(lastSeen)) return null
  const lastSeenAnalysisFingerprints: Partial<Record<OracleTopicId, string>> = {}
  for (const [topicId, fingerprint] of Object.entries(lastSeen)) {
    if (!isOracleTopicId(topicId) || !validFingerprint(fingerprint)) return null
    lastSeenAnalysisFingerprints[topicId] = fingerprint
  }

  if (!Array.isArray(record.selectedWeekdays) || record.selectedWeekdays.length > 7
    || record.selectedWeekdays.some((day) => !WEEKDAYS.includes(day as OracleWeekday))) return null
  const selectedWeekdays = [...new Set(record.selectedWeekdays)] as OracleWeekday[]
  const participation = record.participationByDate
  if (typeof participation !== "object" || participation === null || Array.isArray(participation)) return null
  const participationByDate: Record<string, OracleParticipationAction> = {}
  for (const [dateKey, action] of Object.entries(participation)) {
    const parsed = parseDateKey(dateKey)
    if (parsed === null || compareDateKeys(dateKey, today) > 0 || !validAction(action)) return null
    participationByDate[dateKey] = action
  }
  return {
    schemaVersion: 1,
    optedIn: record.optedIn,
    savedTopicIds,
    lastSelectedTopicId: record.lastSelectedTopicId as OracleTopicId | null,
    lastSeenAnalysisFingerprints,
    selectedWeekdays,
    participationByDate,
  }
}

type StoreDependencies = {
  readonly storage?: Storage | null
  readonly scope?: () => OracleReturnScope
  readonly today?: () => string
}

function mutationError(code: OracleReturnErrorCode): OracleReturnMutation {
  return { ok: false, code }
}

export function createOracleReturnStore(dependencies: StoreDependencies = {}) {
  const storage = dependencies.storage === undefined ? browserStorage() : dependencies.storage
  const scope = dependencies.scope ?? scopeForCurrentUser
  const today = dependencies.today ?? (() => localOracleDateKey())

  function read(): OracleReturnRead {
    const currentScope = scope()
    if (currentScope.kind === "unresolved") return { status: "unresolved", scope: currentScope, state: defaultState() }
    if (storage === null) return { status: "unavailable", scope: currentScope, state: defaultState() }
    const key = storageKey(currentScope)
    if (key === null) return { status: "unresolved", scope: currentScope, state: defaultState() }
    try {
      const raw = storage.getItem(key)
      if (raw === null) return { status: "ready", scope: currentScope, state: defaultState() }
      const parsed = parseState(JSON.parse(raw), today())
      return parsed === null
        ? { status: "corrupt", scope: currentScope, state: defaultState() }
        : { status: "ready", scope: currentScope, state: parsed }
    } catch {
      return { status: "corrupt", scope: currentScope, state: defaultState() }
    }
  }

  function write(next: OracleReturnState, requireOptIn = true): OracleReturnMutation {
    const snapshot = read()
    if (snapshot.status === "unresolved") return mutationError("SCOPE_UNAVAILABLE")
    if (snapshot.status === "unavailable") return mutationError("STORAGE_UNAVAILABLE")
    if (snapshot.status === "corrupt") return mutationError("INVALID_STORAGE")
    if (requireOptIn && !snapshot.state.optedIn) return mutationError("OPT_IN_REQUIRED")
    const key = storageKey(snapshot.scope)
    if (storage === null || key === null) return mutationError("STORAGE_UNAVAILABLE")
    try {
      const raw = JSON.stringify(next)
      storage.setItem(key, raw)
      if (storage.getItem(key) !== raw) return mutationError("STORAGE_UNAVAILABLE")
      if (typeof window !== "undefined" && storage === window.localStorage) {
        window.dispatchEvent(new Event(ORACLE_RETURN_STATE_EVENT))
      }
      return { ok: true, state: next }
    } catch {
      return mutationError("STORAGE_UNAVAILABLE")
    }
  }

  function enableOptIn(): OracleReturnMutation {
    const snapshot = read()
    if (snapshot.status === "unresolved") return mutationError("SCOPE_UNAVAILABLE")
    if (snapshot.status === "unavailable") return mutationError("STORAGE_UNAVAILABLE")
    if (snapshot.status === "corrupt") return mutationError("INVALID_STORAGE")
    if (snapshot.state.optedIn) return { ok: true, state: snapshot.state }
    return write({ ...snapshot.state, optedIn: true }, false)
  }

  function saveInterest(topicId: OracleTopicId): OracleReturnMutation {
    if (!isOracleTopicId(topicId)) return mutationError("INVALID_TOPIC")
    const snapshot = read()
    if (snapshot.status !== "ready") return write(snapshot.state)
    if (snapshot.state.savedTopicIds.includes(topicId)) return { ok: true, state: snapshot.state }
    return write({ ...snapshot.state, savedTopicIds: [...snapshot.state.savedTopicIds, topicId] })
  }

  function removeInterest(topicId: OracleTopicId): OracleReturnMutation {
    if (!isOracleTopicId(topicId)) return mutationError("INVALID_TOPIC")
    const snapshot = read()
    if (snapshot.status !== "ready") return write(snapshot.state)
    return write({
      ...snapshot.state,
      savedTopicIds: snapshot.state.savedTopicIds.filter((id) => id !== topicId),
    })
  }

  function selectTopic(topicId: OracleTopicId): OracleReturnMutation {
    if (!isOracleTopicId(topicId)) return mutationError("INVALID_TOPIC")
    const snapshot = read()
    if (snapshot.status !== "ready") return write(snapshot.state)
    if (snapshot.state.lastSelectedTopicId === topicId) return { ok: true, state: snapshot.state }
    return write({ ...snapshot.state, lastSelectedTopicId: topicId })
  }

  function markTopicSeen(topicId: OracleTopicId, fingerprint: string): OracleReturnMutation {
    if (!isOracleTopicId(topicId)) return mutationError("INVALID_TOPIC")
    if (!validFingerprint(fingerprint)) return mutationError("INVALID_FINGERPRINT")
    const snapshot = read()
    if (snapshot.status !== "ready") return write(snapshot.state)
    if (snapshot.state.lastSeenAnalysisFingerprints[topicId] === fingerprint) return { ok: true, state: snapshot.state }
    return write({
      ...snapshot.state,
      lastSeenAnalysisFingerprints: { ...snapshot.state.lastSeenAnalysisFingerprints, [topicId]: fingerprint },
    })
  }

  function isTopicUnread(topicId: OracleTopicId, fingerprint: string): boolean {
    if (!isOracleTopicId(topicId) || !validFingerprint(fingerprint)) return false
    const snapshot = read()
    if (snapshot.status !== "ready" || !snapshot.state.optedIn || !snapshot.state.savedTopicIds.includes(topicId)) return false
    const previous = snapshot.state.lastSeenAnalysisFingerprints[topicId]
    return validFingerprint(previous) && previous !== fingerprint
  }

  function setParticipationWeekdays(days: readonly number[]): OracleReturnMutation {
    if (!Array.isArray(days) || days.some((day) => !WEEKDAYS.includes(day as OracleWeekday))) return mutationError("INVALID_WEEKDAY")
    const selectedWeekdays = [...new Set(days)].sort((left, right) => left - right) as OracleWeekday[]
    const snapshot = read()
    if (snapshot.status !== "ready") return write(snapshot.state)
    if (selectedWeekdays.join(",") === snapshot.state.selectedWeekdays.join(",")) return { ok: true, state: snapshot.state }
    return write({ ...snapshot.state, selectedWeekdays })
  }

  function recordParticipation(action: OracleParticipationAction, dateKey = today()): OracleReturnMutation {
    if (!validAction(action)) return mutationError("INVALID_ACTION")
    const parsed = parseDateKey(dateKey)
    if (parsed === null) return mutationError("INVALID_DATE")
    const todayKey = today()
    if (parseDateKey(todayKey) === null) return mutationError("INVALID_DATE")
    if (compareDateKeys(dateKey, todayKey) > 0) return mutationError("FUTURE_DATE")
    const snapshot = read()
    if (snapshot.status !== "ready") return write(snapshot.state)
    if (!snapshot.state.optedIn) return mutationError("OPT_IN_REQUIRED")
    if (snapshot.state.selectedWeekdays.length === 0) return mutationError("NO_DAYS_SELECTED")
    if (snapshot.state.participationByDate[dateKey] !== undefined) return mutationError("ALREADY_RECORDED")
    return write({
      ...snapshot.state,
      participationByDate: { ...snapshot.state.participationByDate, [dateKey]: action },
    })
  }

  function getParticipationSummary(dateKey = today()): { readonly cumulative: number; readonly streak: number; readonly recordedDates: readonly string[] } {
    const snapshot = read()
    if (snapshot.status !== "ready") return { cumulative: 0, streak: 0, recordedDates: [] }
    const recordedDates = Object.keys(snapshot.state.participationByDate).sort()
    if (snapshot.state.selectedWeekdays.length === 0 || recordedDates.length === 0) {
      return { cumulative: recordedDates.length, streak: 0, recordedDates }
    }
    const recorded = new Set(recordedDates)
    const eligible = new Set(snapshot.state.selectedWeekdays)
    const previousEligibleDate = (from: string): string => {
      let candidate = addDays(from, -1)
      while (!eligible.has(weekday(candidate))) candidate = addDays(candidate, -1)
      return candidate
    }
    let cursor = dateKey
    // A selected day that is still today is not a missed day yet. Past
    // selected days, however, must be present or the current streak is zero.
    if (eligible.has(weekday(cursor)) && !recorded.has(cursor)) cursor = previousEligibleDate(cursor)
    while (!eligible.has(weekday(cursor))) cursor = previousEligibleDate(cursor)
    if (!recorded.has(cursor)) return { cumulative: recordedDates.length, streak: 0, recordedDates }
    let streak = 0
    while (eligible.has(weekday(cursor)) && recorded.has(cursor)) {
      streak += 1
      const previous = previousEligibleDate(cursor)
      if (!recorded.has(previous)) break
      cursor = previous
    }
    return { cumulative: recordedDates.length, streak, recordedDates }
  }

  return {
    read,
    enableOptIn,
    saveInterest,
    removeInterest,
    selectTopic,
    markTopicSeen,
    isTopicUnread,
    setParticipationWeekdays,
    recordParticipation,
    getParticipationSummary,
    onScopeChange: onLocalJournalScopeChange,
  }
}

export type OracleReturnStore = ReturnType<typeof createOracleReturnStore>
