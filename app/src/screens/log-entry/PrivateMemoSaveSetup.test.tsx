import React from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { RaceForm } from "./RaceForm"
import { PrivateMemoSaveSetup } from "./PrivateMemoSaveSetup"
import { loadEntries, loadEntriesWithPrivateMemos, savePrivateEntry } from "../../domain/journal-store"
import { createRecoveryCode } from "../../domain/account/private-note-crypto"
import { clearSessionRecoveryCode, loadSessionRecoveryCode, saveSessionRecoveryCode } from "../../domain/account/private-note-sync"
import { LOCAL_JOURNAL_OWNERSHIP_KEY, setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { StickyBar } from "./StickyBar"
import * as privateCrypto from "../../domain/account/private-note-crypto"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); clearSessionRecoveryCode() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); clearSessionRecoveryCode() })

it("keeps the race input and explains missing encryption setup instead of blaming storage capacity", async () => {
  const done = vi.fn()
  render(<RaceForm targetDate="2026-09-13" onDone={done} />)
  fireEvent.click(screen.getByRole("radio", { name: "나만의 메모" }))
  fireEvent.change(screen.getByLabelText("경기 메모"), { target: { value: "synthetic-private-race" } })
  fireEvent.click(screen.getByRole("button", { name: /^저장/ }))
  expect(await screen.findByRole("alert")).toHaveTextContent("복구 코드를 준비")
  expect(screen.queryByTestId("save-error")).not.toBeInTheDocument()
  expect(screen.getByLabelText("경기 메모")).toHaveValue("synthetic-private-race")
  expect(loadEntries()).toEqual([])
  expect(done).not.toHaveBeenCalled()
})

it("prepares a new code in place only after acknowledgement, then encrypts the unchanged race memo", async () => {
  const done = vi.fn()
  render(<RaceForm targetDate="2026-09-13" onDone={done} />)
  fireEvent.click(screen.getByRole("radio", { name: "나만의 메모" }))
  fireEvent.change(screen.getByLabelText("경기 메모"), { target: { value: "synthetic-private-race" } })
  fireEvent.click(screen.getByRole("button", { name: /처음 사용해요/ }))
  expect(loadSessionRecoveryCode()).toBeNull()
  expect(screen.getByRole("button", { name: "이 코드로 저장 준비" })).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox", { name: "복구 코드를 따로 보관했어요" }))
  fireEvent.click(screen.getByRole("button", { name: "이 코드로 저장 준비" }))
  await screen.findByText(/암호화 준비가 됐어요/)
  expect(done).not.toHaveBeenCalled()
  expect(loadEntries()).toEqual([])
  fireEvent.click(screen.getByRole("button", { name: /^저장/ }))
  await waitFor(() => expect(done).toHaveBeenCalledTimes(1))
  expect(loadEntries()).toHaveLength(1)
  expect(JSON.stringify(localStorage)).not.toContain("synthetic-private-race")
  const hydrated = await loadEntriesWithPrivateMemos()
  expect(hydrated[0]).toMatchObject({ memo: "synthetic-private-race", memoPurpose: "PRIVATE_SELF_ONLY" })
})

it("refuses a new or incorrect code when existing private records need their original code", async () => {
  const code = createRecoveryCode()
  expect(saveSessionRecoveryCode(code)).toBe(true)
  expect((await savePrivateEntry({ id: "private-fixture", kind: "race", date: "2026-09-13",
    savedAt: "2026-09-13T00:00:00.000Z", syncState: "local", stage: "pre", record: "", rank: "", result: "",
    memo: "synthetic-existing", memoPurpose: "PRIVATE_SELF_ONLY" })).ok).toBe(true)
  clearSessionRecoveryCode()
  const before = JSON.stringify(localStorage)
  const ready = vi.fn()
  render(<PrivateMemoSaveSetup onReady={ready} />)
  fireEvent.click(screen.getByRole("button", { name: /처음 사용해요/ }))
  expect(screen.getByRole("alert")).toHaveTextContent("기존 복구 코드")
  fireEvent.change(screen.getByLabelText("기존 복구 코드"), { target: { value: createRecoveryCode() } })
  fireEvent.click(screen.getByRole("button", { name: "이 코드로 저장 준비" }))
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("맞지 않거나"))
  expect(ready).not.toHaveBeenCalled()
  expect(loadSessionRecoveryCode()).toBeNull()
  expect(JSON.stringify(localStorage)).toBe(before)
  fireEvent.change(screen.getByLabelText("기존 복구 코드"), { target: { value: code } })
  fireEvent.click(screen.getByRole("button", { name: "이 코드로 저장 준비" }))
  await waitFor(() => expect(ready).toHaveBeenCalledTimes(1))
  expect(loadSessionRecoveryCode()).toBe(code)
})

it("never diagnoses storage capacity or asks users to delete data for an unclassified failure", () => {
  render(<StickyBar error />)
  expect(screen.getByRole("alert")).toHaveTextContent("새로고침하거나 앱 데이터를 지우지 말고")
  expect(screen.getByRole("alert")).not.toHaveTextContent("가득")
})

async function seedPrivateVault() {
  const code = createRecoveryCode()
  saveSessionRecoveryCode(code)
  expect((await savePrivateEntry({ id: "private-fixture", kind: "race", date: "2026-09-13",
    savedAt: "2026-09-13T00:00:00.000Z", syncState: "local", stage: "pre", record: "", rank: "", result: "",
    memo: "synthetic-existing", memoPurpose: "PRIVATE_SELF_ONLY" })).ok).toBe(true)
  clearSessionRecoveryCode()
  return code
}

it("does not treat orphan ciphertext as an empty vault or activate a replacement key", async () => {
  await seedPrivateVault()
  localStorage.removeItem("trainoracle.journal.v1")
  const vault = localStorage.getItem("trainoracle.private-memo.v1")
  const ready = vi.fn()
  render(<PrivateMemoSaveSetup onReady={ready} />)
  fireEvent.click(screen.getByRole("button", { name: /처음 사용해요/ }))
  expect(screen.queryByLabelText("보관할 복구 코드")).not.toBeInTheDocument()
  expect(screen.getByRole("alert")).toBeVisible()
  fireEvent.change(screen.getByLabelText("기존 복구 코드"), { target: { value: createRecoveryCode() } })
  fireEvent.click(screen.getByRole("button", { name: "이 코드로 저장 준비" }))
  await waitFor(() => expect(screen.getByRole("alert")).toBeVisible())
  expect(ready).not.toHaveBeenCalled()
  expect(loadSessionRecoveryCode()).toBeNull()
  expect(localStorage.getItem("trainoracle.private-memo.v1")).toBe(vault)
})

it("rejects activation when the journal changes during asynchronous key verification", async () => {
  const code = await seedPrivateVault()
  const decrypt = privateCrypto.decryptPrivateNote
  vi.spyOn(privateCrypto, "decryptPrivateNote").mockImplementationOnce(async (...args) => {
    localStorage.setItem("trainoracle.journal.v1", "[]")
    return decrypt(...args)
  })
  const ready = vi.fn()
  render(<PrivateMemoSaveSetup onReady={ready} />)
  fireEvent.change(screen.getByLabelText("기존 복구 코드"), { target: { value: code } })
  fireEvent.click(screen.getByRole("button", { name: "이 코드로 저장 준비" }))
  await screen.findByRole("alert")
  expect(ready).not.toHaveBeenCalled()
  expect(loadSessionRecoveryCode()).toBeNull()
})

it("rejects ownership-only changes during verification without installing the key", async () => {
  const code = await seedPrivateVault()
  const decrypt = privateCrypto.decryptPrivateNote
  vi.spyOn(privateCrypto, "decryptPrivateNote").mockImplementationOnce(async (...args) => {
    localStorage.setItem(LOCAL_JOURNAL_OWNERSHIP_KEY, JSON.stringify({ schemaVersion: 1,
      ownerByEntryId: { "private-fixture": "another-synthetic-owner" } }))
    return decrypt(...args)
  })
  const ready = vi.fn()
  render(<PrivateMemoSaveSetup onReady={ready} />)
  fireEvent.change(screen.getByLabelText("기존 복구 코드"), { target: { value: code } })
  fireEvent.click(screen.getByRole("button", { name: "이 코드로 저장 준비" }))
  await screen.findByRole("alert")
  expect(ready).not.toHaveBeenCalled()
  expect(loadSessionRecoveryCode()).toBeNull()
})
