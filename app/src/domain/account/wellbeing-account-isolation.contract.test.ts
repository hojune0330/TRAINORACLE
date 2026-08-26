import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  DAILY_CONTEXT_STORAGE_KEY,
  loadDailyContext,
  saveDailyContext,
} from "../daily-context"
import {
  FATIGUE_EXPERIMENT_STORAGE_KEY,
  loadFatigueExperiment,
  saveFatigueExperiment,
} from "../fatigue-experiment-store"
import { fatigueVector } from "../fatigue-vector"
import { eraseAllLocalData, erasableKeys } from "../erase-local-data"
import { accountScopedStorageKeyFor } from "./local-account-scope"
import { setActiveLocalAccount } from "./local-journal-ownership"
import { loadSyncConsent, saveSyncConsent, SYNC_CONSENT_STORAGE_KEY } from "./sync-local"
import { loadSessionRecoveryCode, saveSessionRecoveryCode } from "./private-note-sync"
import { createRecoveryCode } from "./private-note-crypto"
import { PRIVATE_NOTE_RECOVERY_STORAGE_KEY } from "../journal-storage-keys"

const DATE = "2026-08-25"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  setActiveLocalAccount(null)
})

afterEach(() => setActiveLocalAccount(null))

describe("account-scoped wellbeing inputs", () => {
  it("keeps daily condition and fatigue experiment choices separate by account", () => {
    expect(saveDailyContext({ date: DATE, mood: "GOOD", body: "LIGHT", weather: "SUNNY" })).toBe(true)
    expect(saveFatigueExperiment({
      optedIn: true,
      vector: fatigueVector({ neural: 1, metabolic: 2, muscular: 3, impact: 4, subjective: 5 }),
      evidence: null,
    })).toBe(true)

    setActiveLocalAccount("account-a")
    expect(loadDailyContext(DATE)).toBeNull()
    expect(loadFatigueExperiment().optedIn).toBe(false)
    expect(saveDailyContext({ date: DATE, mood: "LOW", body: "TIRED", weather: "RAINY" })).toBe(true)

    setActiveLocalAccount(null)
    expect(loadDailyContext(DATE)?.mood).toBe("GOOD")
    expect(loadFatigueExperiment().optedIn).toBe(true)
    setActiveLocalAccount("account-a")
    expect(loadDailyContext(DATE)?.mood).toBe("LOW")
  })

  it("erases wellbeing data and temporary account setup from every scope", () => {
    const dailyAccountKey = accountScopedStorageKeyFor(DAILY_CONTEXT_STORAGE_KEY, "account-a")
    const fatigueAccountKey = accountScopedStorageKeyFor(FATIGUE_EXPERIMENT_STORAGE_KEY, "account-a")
    window.localStorage.setItem(dailyAccountKey, "{}")
    window.localStorage.setItem(fatigueAccountKey, "{}")
    window.localStorage.setItem("trainoracle.account.setup-receipt.v1", "{}")
    window.sessionStorage.setItem("trainoracle.account.pending-setup.v1", "{}")

    expect(erasableKeys()).toEqual(expect.arrayContaining([
      dailyAccountKey,
      fatigueAccountKey,
      "trainoracle.account.setup-receipt.v1",
      "trainoracle.account.pending-setup.v1",
    ]))
    expect(eraseAllLocalData()).toMatchObject({ ok: true, cleared: 4 })
  })

  it("keeps sync consent and private-note recovery codes separate by account", () => {
    const deviceCode = createRecoveryCode()
    const accountCode = createRecoveryCode()
    expect(saveSyncConsent({ enabled: true, shareTrainingNotes: false })).toBe(true)
    expect(saveSessionRecoveryCode(deviceCode)).toBe(true)

    setActiveLocalAccount("account-a")
    expect(loadSyncConsent()).toEqual({ enabled: false, shareTrainingNotes: false })
    expect(loadSessionRecoveryCode()).toBeNull()
    expect(saveSyncConsent({ enabled: true, shareTrainingNotes: true })).toBe(true)
    expect(saveSessionRecoveryCode(accountCode)).toBe(true)

    setActiveLocalAccount(null)
    expect(loadSyncConsent()).toEqual({ enabled: true, shareTrainingNotes: false })
    expect(loadSessionRecoveryCode()).toBe(deviceCode)
    setActiveLocalAccount("account-a")
    expect(loadSyncConsent()).toEqual({ enabled: true, shareTrainingNotes: true })
    expect(loadSessionRecoveryCode()).toBe(accountCode)
  })

  it("erases account-scoped consent and recovery codes", () => {
    const consentKey = accountScopedStorageKeyFor(SYNC_CONSENT_STORAGE_KEY, "account-a")
    const recoveryKey = accountScopedStorageKeyFor(PRIVATE_NOTE_RECOVERY_STORAGE_KEY, "account-a")
    window.localStorage.setItem(consentKey, "{}")
    window.sessionStorage.setItem(recoveryKey, "secret")

    expect(erasableKeys()).toEqual(expect.arrayContaining([consentKey, recoveryKey]))
    expect(eraseAllLocalData()).toMatchObject({ ok: true, cleared: 2 })
  })
})
