import { test, expect } from "@playwright/test"

test("two actual device tabs preserve the canonical body record when a legacy writer drops its companion", async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: "block" })
  // This tests the real storage module, not account admission or app startup.
  // An inert same-origin fixture keeps both tabs free of production API calls.
  await context.route("**/*", route => {
    const url = new URL(route.request().url())
    if (url.origin !== "http://127.0.0.1:4381") return route.abort()
    if (url.pathname === "/__account_record_test__") return route.fulfill({
      status: 200, contentType: "text/html", body: "<!doctype html><html><head><title>Synthetic device storage</title></head><body></body></html>",
    })
    return route.continue()
  })
  const current = await context.newPage(), legacy = await context.newPage()
  try {
    await current.goto("http://127.0.0.1:4381/__account_record_test__")
    await legacy.goto("http://127.0.0.1:4381/__account_record_test__")
    const initial = await current.evaluate(async () => {
      const key = "trainoracle.journal.v1"
      const record = { id: "synthetic-device-body", kind: "evening", date: "2026-10-12",
        savedAt: "2026-10-12T00:00:00.000Z", syncState: "local", sleepH: 0, sleepQuality: 0,
        weightKg: "", restingHr: "", painParts: {}, mood: 0, note: "",
        fieldProvenance: { painParts: { provenance: "EXPLICIT" } }, bodyPartMetadata: {
          schemaVersion: 1, observations: [{ id: "other_11111111-1111-4111-8111-111111111111",
            labelSnapshot: "SYNTHETIC_PRIVATE_LABEL", severity: 4, note: "SYNTHETIC_PRIVATE_NOTE" }] } }
      const original = JSON.stringify([record])
      localStorage.setItem(key, original)
      const modulePath = "/src/domain/journal-device-storage.ts"
      const m = await import(/* @vite-ignore */ modulePath)
      const store = m.canonicalJournalStorage(localStorage)
      const firstRead = store.getItem(key)
      const expectedCanonical = JSON.stringify([record, { ...record, id: "synthetic-new-body" }])
      const saved = m.writeJournalDeviceValues(store, {
        [key]: expectedCanonical,
      }, { [key]: original })
      return { saved, firstRead, original, legacyOriginal: localStorage.getItem(key),
        pointer: localStorage.getItem(m.JOURNAL_DEVICE_POINTER_KEY), count: JSON.parse(store.getItem(key)).length,
        expectedCanonical, canonicalValue: store.getItem(key) }
    })
    expect(initial.saved).toBe(true)
    expect(initial.firstRead).toBe(initial.original)
    expect(initial.legacyOriginal).toBe(initial.original)
    expect(initial.count).toBe(2)
    expect(initial.canonicalValue).toBe(initial.expectedCanonical)
    const overwritten = await legacy.evaluate(() => {
      const key = "trainoracle.journal.v1"
      const entries = JSON.parse(localStorage.getItem(key)!)
      delete entries[0].bodyPartMetadata
      const value = JSON.stringify(entries)
      localStorage.setItem(key, value)
      return value
    })
    for (const reload of [false, true]) {
      if (reload) await current.reload()
      const state = await current.evaluate(async () => {
        const modulePath = "/src/domain/journal-device-storage.ts"
        const m = await import(/* @vite-ignore */ modulePath)
        let uncertain = false
        try { m.canonicalJournalStorage(localStorage).getItem("trainoracle.journal.v1") }
        catch (error) { uncertain = error instanceof Error && error.message === "JOURNAL_DEVICE_STORAGE_UNCERTAIN" }
        const payloads = Object.keys(localStorage).filter(key => key.startsWith(m.JOURNAL_DEVICE_PREFIX))
          .map(key => localStorage.getItem(key)).join("\n")
        const pointer = localStorage.getItem(m.JOURNAL_DEVICE_POINTER_KEY)!
        const generation = JSON.parse(localStorage.getItem(`${m.JOURNAL_DEVICE_PREFIX}generation:${JSON.parse(pointer).head}`)!)
        return { uncertain, pointer: localStorage.getItem(m.JOURNAL_DEVICE_POINTER_KEY),
          legacyValue: localStorage.getItem("trainoracle.journal.v1"),
          bodyPreserved: payloads.includes("SYNTHETIC_PRIVATE_LABEL"), newRecordPreserved: payloads.includes("synthetic-new-body"),
          canonicalValue: generation.values["trainoracle.journal.v1"] }
      })
      expect(state).toEqual({ uncertain: true, pointer: initial.pointer, legacyValue: overwritten,
        bodyPreserved: true, newRecordPreserved: true, canonicalValue: initial.expectedCanonical })
    }
  } finally { await context.close() }
})
