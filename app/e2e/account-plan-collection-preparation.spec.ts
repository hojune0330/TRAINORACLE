import { test, expect, type Page } from "@playwright/test"
import type {} from "./fixtures/account-plan-collection-preparation"
import type { AccountPlanCollectionClient } from "../src/domain/account/account-plan-collection-api"

async function load(page: Page) {
  await page.goto("/__collection_preparation_test__")
  await page.evaluate(async () => {
    const path = "/e2e/fixtures/account-plan-collection-preparation.ts"
    ;(await import(/* @vite-ignore */ path)).setup()
  })
}
test.beforeEach(async ({ context, page }) => {
  await context.route("**/__collection_preparation_test__", route => route.fulfill({
    contentType: "text/html", body: '<!doctype html><meta charset="utf-8"><title>Synthetic preparation test</title>',
  }))
  await load(page)
})

test("native SELECT preparation survives first-snapshot scope close and page reload, visible only to A", async ({ page }) => {
  const before = await page.evaluate(async () => {
    const h = window.accountPreparationHarness, input = h.fixture(), buffer = h.open()
    await buffer.observe(h.split(input.previous).index, 1)
    const put = IDBObjectStore.prototype.put
    let intercepted = false
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      const result = put.apply(this, args)
      if (!intercepted && this.transaction.db.name === "trainoracle-account-plan-collection-parts-v1") {
        intercepted = true
        this.transaction.addEventListener("complete", () => { h.scope.owner = h.other; buffer.close() })
      }
      return result
    }
    let error: string | null
    try { error = await h.rejected(() => buffer.save(input.transfer, 1)) }
    finally { IDBObjectStore.prototype.put = put }
    const prep = h.createPreparation(), raw = await h.raw()
    const isolated = await prep.read(h.other, () => true)
    const recovered = await prep.read(h.owner, () => true)
    prep.close()
    return { error, intercepted, isolated, operationId: input.transfer.operationId, previous: input.transfer.previous!,
      expected: h.fingerprint(input.transfer), recovered: h.fingerprint(recovered?.transfer),
      rows: raw.rows.length, encrypted: raw.rows.every(row => row.ciphertext instanceof Uint8Array && row.iv.length === 12),
      keys: raw.keys.map(v => ({ native: v.key instanceof CryptoKey, extractable: v.key.extractable })) }
  })
  expect(before).toMatchObject({ error: "STALE", intercepted: true, isolated: null, encrypted: true,
    keys: [{ native: true, extractable: false }] })
  expect(before.rows).toBe(6)
  expect(before.recovered).toBe(before.expected)
  await load(page)
  const after = await page.evaluate(async previous => {
    const h = window.accountPreparationHarness, buffer = h.open()
    const path = "/src/domain/account/account-plan-collection-service.ts"
    const { createAccountPlanCollectionService } = await import(/* @vite-ignore */ path)
    const client: AccountPlanCollectionClient = {
      readIndex: async () => ({ revision: 1, index: previous.index }), readLegacy: async () => null,
      readPart: async (_owner, kind, id) => [...previous.snapshots, ...previous.progress].find(part => part.kind === kind && part.id === id) ?? null, receipt: async () => null,
      stage: async () => { throw Error("Unapproved replay") }, commit: async () => { throw Error("Unapproved replay") },
    }
    const service = createAccountPlanCollectionService({ ownerId: h.owner, isCurrent: () => true, client, buffer })
    await service.hydrate()
    const view = await buffer.read(), pending = await buffer.pending()
    const serviceStatus = service.snapshot().status
    service.close()
    return { serviceStatus, state: view?.state, operationId: pending?.operationId, transfer: h.fingerprint(pending),
      rows: (await h.raw()).rows.length }
  }, before.previous)
  expect(after).toEqual({ serviceStatus: "PENDING", state: "PENDING", operationId: before.operationId, transfer: before.expected, rows: 0 })
})

for (const fault of ["quota", "abort", "scope-close"] as const) {
  test(`native atomic ${fault} after the first payload leaves zero intent, parts and keys`, async ({ page }) => {
    const result = await page.evaluate(async fault => {
      const h = window.accountPreparationHarness, prep = h.createPreparation(), input = h.fixture()
      const add = IDBObjectStore.prototype.add
      let writes = 0
      IDBObjectStore.prototype.add = function (...args: Parameters<typeof add>) {
        if (this.name === "payloads" && ++writes === 2 && fault === "quota") throw new DOMException("Synthetic quota", "QuotaExceededError")
        const result = add.apply(this, args)
        if (this.name === "payloads" && writes === 1) {
          if (fault === "abort") this.transaction.abort()
          if (fault === "scope-close") { h.scope.owner = h.other; prep.close() }
        }
        return result
      }
      let error: string | null
      try { error = await h.rejected(() => prep.save(input, () => h.scope.owner === h.owner)) }
      finally { IDBObjectStore.prototype.add = add; prep.close() }
      const reopened = h.createPreparation(), raw = await h.raw(), recovered = await reopened.read(h.owner, () => true)
      reopened.close()
      return { error, writes, rows: raw.rows.length, keys: raw.keys.length, recovered }
    }, fault)
    expect(result.error).not.toBeNull()
    expect(result.writes).toBeGreaterThan(0)
    expect(result).toMatchObject({ rows: 0, keys: 0, recovered: null })
  })
}

test("native preparation captures before await and same-owner competing tabs cannot overwrite a fixed operation", async ({ page, context }) => {
  const second = await context.newPage(); await load(second)
  const initial = await page.evaluate(async () => {
    const h = window.accountPreparationHarness, prep = h.createPreparation(), input = h.fixture()
    const expected = h.fingerprint(input.transfer), operationId = input.transfer.operationId
    const saving = prep.save(input, () => true)
    input.transfer.next.snapshots.length = 0
    await saving
    const recovered = await prep.read(h.owner, () => true)
    prep.close()
    return { expected, recovered: h.fingerprint(recovered?.transfer), operationId, callerLength: input.transfer.next.snapshots.length }
  })
  expect(initial.recovered).toBe(initial.expected)
  expect(initial.callerLength).toBe(0)
  const losing = await second.evaluate(async () => {
    const h = window.accountPreparationHarness, prep = h.createPreparation(), input = h.fixture()
    const error = await h.rejected(() => prep.save(input, () => true))
    const retained = await prep.read(h.owner, () => true)
    const wrongClear = await h.rejected(() => prep.clear(h.owner, input.transfer.operationId, () => true))
    prep.close()
    return { error, wrongClear, operationId: retained?.transfer.operationId, fingerprint: h.fingerprint(retained?.transfer) }
  })
  expect(losing).toEqual({ error: "CONFLICT", wrongClear: "CONFLICT", operationId: initial.operationId, fingerprint: initial.expected })
})

test("native tampered or missing encrypted preparation never masquerades as an absent pending operation", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountPreparationHarness, prep = h.createPreparation(), input = h.fixture()
    await prep.save(input, () => true)
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(h.databaseName); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("payloads", "readwrite"), store = tx.objectStore("payloads")
        const request = store.get([h.owner, "intent"])
        request.onsuccess = () => { const row = request.result; row.ciphertext[0] ^= 1; store.put(row) }
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error)
      })
    } finally { db.close() }
    const error = await h.rejected(() => prep.read(h.owner, () => true))
    const buffer = h.open(), readError = await h.rejected(() => buffer.read())
    buffer.close(); prep.close()
    return { error, readError, rows: (await h.raw()).rows.length }
  })
  expect(result).toEqual({ error: "INVALID", readError: "INVALID", rows: 6 })
})

test("native 100-plan encrypted preparation keeps each part bounded and fully recoverable", async ({ page }) => {
  test.setTimeout(120_000)
  const result = await page.evaluate(async () => {
    const h = window.accountPreparationHarness, input = h.fixture(100), prep = h.createPreparation()
    await prep.save(input, () => true)
    const recovered = await prep.read(h.owner, () => true), raw = await h.raw()
    const expected = h.fingerprint(input.transfer)
    const plaintextBytes = new TextEncoder().encode(JSON.stringify(input.transfer.next)).byteLength
    const maxCiphertextBytes = Math.max(...raw.rows.map(row => row.ciphertext.byteLength))
    prep.close()
    return { plaintextBytes, maxCiphertextBytes, complete: h.fingerprint(recovered?.transfer) === expected,
      plans: recovered?.transfer.next.index.plans.length, rows: raw.rows.length }
  })
  expect(result.plaintextBytes).toBeGreaterThan(100_000)
  expect(result.maxCiphertextBytes).toBeLessThanOrEqual(500_016)
  expect(result).toMatchObject({ complete: true, plans: 100, rows: 202 })
})
