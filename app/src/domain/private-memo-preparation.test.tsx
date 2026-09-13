import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { createRecoveryCode, decryptPrivateNote } from "./account/private-note-crypto"
import * as privateCrypto from "./account/private-note-crypto"
import { clearSessionRecoveryCode, loadSessionRecoveryCode, saveSessionRecoveryCode } from "./account/private-note-sync"
import { setActiveLocalAccount, LOCAL_JOURNAL_OWNERSHIP_KEY } from "./account/local-journal-ownership"
import { deleteEntry, loadEntriesWithPrivateMemos, restoreDeletedEntry, savePrivateEntry } from "./journal-store"
import { hasRetainedPrivateMemos, preparePrivateMemoCode } from "./private-memo-preparation"
import { readTrashForRecovery, JOURNAL_TRASH_STORAGE_KEY } from "./journal-trash"
import { PrivateMemoSaveSetup } from "../screens/log-entry/PrivateMemoSaveSetup"
import { RaceForm } from "../screens/log-entry/RaceForm"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); clearSessionRecoveryCode() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); clearSessionRecoveryCode() })
const entry = (id: string) => ({ id, kind: "race", date: "2026-09-13", savedAt: "2026-09-13T00:00:00.000Z", syncState: "local", stage: "pre", record: "", rank: "", result: "", memo: `synthetic-${id}`, memoPurpose: "PRIVATE_SELF_ONLY" })
async function seed(id: string, code: string) {
  saveSessionRecoveryCode(code)
  expect((await savePrivateEntry(entry(id))).ok).toBe(true)
  clearSessionRecoveryCode()
}

it("includes trash ciphertext before allowing new keys and restores with the original key", async () => {
  const code = createRecoveryCode()
  await seed("old", code)
  expect(deleteEntry("old")).toMatchObject({ ok: true, trashed: true })
  expect(hasRetainedPrivateMemos()).toBe(true)
  render(<PrivateMemoSaveSetup requested onReady={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: /처음 사용해요/ }))
  expect(screen.queryByLabelText("보관할 복구 코드")).toBeNull()
  expect(screen.getByRole("alert")).toHaveTextContent("휴지통")
  expect(await preparePrivateMemoCode(code, undefined, () => true)).toBe("READY")
  expect(restoreDeletedEntry("old").ok).toBe(true)
  expect((await loadEntriesWithPrivateMemos())[0]).toMatchObject({ memo: "synthetic-old" })
})

it("offers setup again when the session code disappears without clearing the draft", async () => {
  saveSessionRecoveryCode(createRecoveryCode())
  render(<RaceForm targetDate="2026-09-13" onDone={() => {}} />)
  fireEvent.click(screen.getByRole("radio", { name: "나만의 메모" }))
  fireEvent.change(screen.getByLabelText("경기 메모"), { target: { value: "synthetic-draft" } })
  expect(screen.getByText(/암호화 준비가 됐어요/)).toBeVisible()
  act(() => clearSessionRecoveryCode())
  fireEvent.click(screen.getByRole("button", { name: /^저장/ }))
  await screen.findByLabelText("기존 복구 코드")
  expect(screen.queryByText(/암호화 준비가 됐어요/)).toBeNull()
  expect(screen.getByLabelText("경기 메모")).toHaveValue("synthetic-draft")
})

it("keeps preparation collapsed while typing and opens only on explicit request", () => {
  render(<RaceForm targetDate="2026-09-13" onDone={() => {}} />)
  fireEvent.click(screen.getByRole("radio", { name: "나만의 메모" }))
  fireEvent.change(screen.getByLabelText("경기 메모"), { target: { value: "synthetic-draft" } })
  expect(screen.getByRole("button", { name: "나만의 메모 저장 준비" })).toHaveAttribute("aria-expanded", "false")
  expect(screen.queryByLabelText("기존 복구 코드")).toBeNull()
})

it("returns to editable existing-code input after a generated session code is cleared", async () => {
  render(<PrivateMemoSaveSetup requested onReady={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: /처음 사용해요/ }))
  fireEvent.click(screen.getByRole("checkbox", { name: "복구 코드를 따로 보관했어요" }))
  fireEvent.click(screen.getByRole("button", { name: "이 코드로 저장 준비" }))
  await screen.findByText(/암호화 준비가 됐어요/)
  act(() => clearSessionRecoveryCode())
  expect(await screen.findByLabelText("기존 복구 코드")).not.toHaveAttribute("readonly")
})

it("repairs mixed keys in both active and trash records without changing journal content", async () => {
  const a = createRecoveryCode(), b = createRecoveryCode()
  await seed("a", a); await seed("b", b)
  expect(deleteEntry("b").trashed).toBe(true)
  const journal = localStorage.getItem("trainoracle.journal.v1")
  const trash = JSON.parse(localStorage.getItem(JOURNAL_TRASH_STORAGE_KEY)!)
  trash[0].historicalExtension = "preserved"
  localStorage.setItem(JOURNAL_TRASH_STORAGE_KEY, JSON.stringify(trash))
  expect(await preparePrivateMemoCode(a, b, () => true)).toBe("READY")
  expect(localStorage.getItem("trainoracle.journal.v1")).toBe(journal)
  expect(JSON.parse(localStorage.getItem(JOURNAL_TRASH_STORAGE_KEY)!)[0].historicalExtension).toBe("preserved")
  expect(restoreDeletedEntry("b").ok).toBe(true)
  expect((await loadEntriesWithPrivateMemos()).filter(value => value.kind === "race" && value.memo !== "")).toHaveLength(2)
  expect(JSON.stringify(localStorage)).not.toContain("synthetic-")
})

it("does not start repairs when any ciphertext cannot be verified", async () => {
  const a = createRecoveryCode(), b = createRecoveryCode()
  await seed("a", a); await seed("b", b)
  const before = JSON.stringify(localStorage)
  expect(await preparePrivateMemoCode(a, createRecoveryCode(), () => true)).toBe("CHECK_CODES_OR_STORAGE")
  expect(JSON.stringify(localStorage)).toBe(before)
  expect(loadSessionRecoveryCode()).toBeNull()
})

it("retains both-code retry after a partial write and completes on retry", async () => {
  const a = createRecoveryCode(), b = createRecoveryCode()
  await seed("active", b); await seed("trash", b); deleteEntry("trash")
  const setItem = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (this === localStorage && key === JOURNAL_TRASH_STORAGE_KEY) throw new DOMException("synthetic-failure", "QuotaExceededError")
    setItem.call(this, key, value)
  })
  expect(await preparePrivateMemoCode(a, b, () => true)).toBe("RETRY_WITH_BOTH_CODES")
  expect(loadSessionRecoveryCode()).toBeNull()
  const retained = readTrashForRecovery(localStorage)!.items[0]!.privateMemo!
  expect(await decryptPrivateNote(retained.encrypted, b)).toBe("synthetic-trash")
  vi.restoreAllMocks()
  expect(await preparePrivateMemoCode(a, b, () => true)).toBe("READY")
  expect(restoreDeletedEntry("trash").ok).toBe(true)
  expect((await loadEntriesWithPrivateMemos()).filter(value => value.kind === "race" && value.memo !== "")).toHaveLength(2)
})

it("requires explicit consent before mixed-code repair in the form", async () => {
  const a = createRecoveryCode(), b = createRecoveryCode()
  await seed("a", a); await seed("b", b)
  render(<PrivateMemoSaveSetup requested onReady={() => {}} />)
  fireEvent.change(screen.getByLabelText("기존 복구 코드"), { target: { value: a } })
  fireEvent.click(screen.getByRole("button", { name: "서로 다른 코드를 쓴 메모 복구" }))
  fireEvent.change(screen.getByLabelText("다른 복구 코드"), { target: { value: b } })
  expect(screen.getByRole("button", { name: "확인하고 첫 번째 코드로 모으기" })).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox", { name: /두 코드를 모두/ }))
  fireEvent.click(screen.getByRole("button", { name: "확인하고 첫 번째 코드로 모으기" }))
  await waitFor(() => expect(screen.getByText(/암호화 준비가 됐어요/)).toBeVisible())
  expect(loadSessionRecoveryCode()).toBe(a)
})

it("fails closed for damaged trash without deleting retained data", () => {
  localStorage.setItem(JOURNAL_TRASH_STORAGE_KEY, "not-json")
  expect(() => hasRetainedPrivateMemos()).toThrow()
  expect(localStorage.getItem(JOURNAL_TRASH_STORAGE_KEY)).toBe("not-json")
})

it("does not decrypt another owner's retained trash", async () => {
  const code = createRecoveryCode()
  await seed("hidden", code); deleteEntry("hidden")
  localStorage.setItem(LOCAL_JOURNAL_OWNERSHIP_KEY, JSON.stringify({ schemaVersion: 1, ownerByEntryId: { hidden: "synthetic-other-owner" } }))
  const decrypt = vi.spyOn(privateCrypto, "decryptPrivateNote")
  expect(await preparePrivateMemoCode(code, undefined, () => true)).toBe("CHECK_CODES_OR_STORAGE")
  expect(decrypt).not.toHaveBeenCalled()
})

it("rejects trash changes during verification without installing a code", async () => {
  const code = createRecoveryCode()
  await seed("retained", code); deleteEntry("retained")
  const decrypt = privateCrypto.decryptPrivateNote
  vi.spyOn(privateCrypto, "decryptPrivateNote").mockImplementationOnce(async (...args) => {
    localStorage.setItem(JOURNAL_TRASH_STORAGE_KEY, "[]")
    return decrypt(...args)
  })
  expect(await preparePrivateMemoCode(code, undefined, () => true)).toBe("CHECK_CODES_OR_STORAGE")
  expect(loadSessionRecoveryCode()).toBeNull()
  expect(localStorage.getItem(JOURNAL_TRASH_STORAGE_KEY)).toBe("[]")
})

it("rejects owner switch-away-and-back during verification", async () => {
  const code = createRecoveryCode()
  await seed("owned", code)
  const decrypt = privateCrypto.decryptPrivateNote
  vi.spyOn(privateCrypto, "decryptPrivateNote").mockImplementationOnce(async (...args) => {
    setActiveLocalAccount("synthetic-other"); setActiveLocalAccount(null)
    return decrypt(...args)
  })
  expect(await preparePrivateMemoCode(code, undefined, () => true)).toBe("CHECK_CODES_OR_STORAGE")
  expect(loadSessionRecoveryCode()).toBeNull()
})
