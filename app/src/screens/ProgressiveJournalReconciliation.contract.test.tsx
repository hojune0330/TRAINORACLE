import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PostSessionForm } from "./log-entry/PostSessionForm"
import { JournalDetailActions } from "./journal-detail-actions"
import { ReviewStage } from "./import-activities/ImportStages"
import { addToJournal, waitingJournal, watchActivity } from "../test/progressive-journal-fixture"
import { buildImportDrafts, confirmImportDrafts, toImportedEntry } from "../domain/import/import-draft"
import type { ImportDraft, ImportSaveIntent } from "../domain/import/import-draft"
import { loadEntries, loadEntriesWithPrivateMemos, saveEntry } from "../domain/journal-store"
import type { PostSessionEntry } from "../domain/journal-schema"
import { createRecoveryCode } from "../domain/account/private-note-crypto"
import { saveSessionRecoveryCode } from "../domain/account/private-note-sync"

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear() })
afterEach(cleanup)

function stored(): PostSessionEntry {
  const entry = loadEntries()[0]
  if (entry?.kind !== "post-session") throw new Error("Missing synthetic entry")
  return entry
}

function seedMixed(): PostSessionEntry {
  const original = waitingJournal()
  expect(saveEntry(original).ok).toBe(true)
  expect(confirmImportDrafts([addToJournal(buildImportDrafts([watchActivity])[0]!, original)], "csv").merged).toBe(1)
  return stored()
}

function ReviewHarness({ draft }: { readonly draft: ImportDraft }) {
  const [selected, setSelected] = React.useState<ReadonlySet<number>>(new Set())
  const [intents, setIntents] = React.useState<ReadonlyMap<number, ImportSaveIntent>>(new Map())
  return <ReviewStage drafts={[draft]} result={{ activities: [watchActivity], format: "csv", skipped: 0 }}
    selected={selected} intents={intents} onToggle={() => setSelected(selected.size === 0 ? new Set([0]) : new Set())}
    onIntent={(index, intent) => setIntents(intent === undefined ? new Map() : new Map([[index, intent]]))}
    onRestart={() => undefined} onSave={() => confirmImportDrafts([{ draft, intent: intents.get(0)! }], "csv")} />
}

describe("progressive journal reconciliation UI", () => {
  it("P2-1 keeps the saved detailed continuation in the import candidate list", async () => {
    const initial = waitingJournal()
    expect(saveEntry(initial).ok).toBe(true)
    const onDone = vi.fn()
    const user = userEvent.setup()
    render(<PostSessionForm initialEntry={initial} onDone={onDone} />)
    await user.clear(screen.getByLabelText("세션 제목"))
    await user.type(screen.getByLabelText("세션 제목"), "Synthetic detail")
    await user.click(screen.getByRole("button", { name: /수정 저장/u }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(stored()).toMatchObject({ id: initial.id, captureDepth: "DETAILED", objectiveDataState: "WAITING" })
    expect(buildImportDrafts([watchActivity])[0]?.reconciliationCandidates.map((entry) => entry.id)).toEqual([initial.id])
  })

  it("P2-2 retains the edit entry point after objective import", async () => {
    const entry = seedMixed()
    const onEditEntry = vi.fn()
    render(<JournalDetailActions date={entry.date} entries={[entry]} onEditEntry={onEditEntry} />)
    await userEvent.setup().click(screen.getByTestId(`journal-edit-${entry.id}`))
    expect(onEditEntry).toHaveBeenCalledWith(entry)
  })

  it.each(["훈련 메모", "나만의 메모"])("keeps objective inputs read-only while saving RPE and %s", async (purpose) => {
    const entry = seedMixed()
    expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
    const onDone = vi.fn()
    const user = userEvent.setup()
    render(<PostSessionForm initialEntry={entry} onDone={onDone} />)
    for (const [label, value] of [["거리 (km)", "5.00"], ["시간 (분)", "25"], ["평균 페이스 (/km)", "5:00"]]) {
      const input = screen.getByLabelText(label!)
      expect(input).toHaveAttribute("readonly")
      await user.type(input, "99")
      expect(input).toHaveValue(value)
    }
    expect(screen.getByRole("button", { name: "휴식" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "건너뜀" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "7" }))
    await user.click(screen.getByRole("radio", { name: purpose }))
    await user.type(screen.getByLabelText("훈련 메모 내용"), "Synthetic diary note")
    await user.click(screen.getByRole("button", { name: /수정 저장/u }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(stored()).toMatchObject({ id: entry.id, rpe: 7, distanceKm: "5.00", durationMin: "25", avgPace: "5:00" })
    expect(stored().fieldProvenance?.distanceKm).toEqual(entry.fieldProvenance?.distanceKm)
    expect((await loadEntriesWithPrivateMemos())[0]).toMatchObject({ memo: "Synthetic diary note" })
  })

  it("refuses a screen event that bypasses the objective read-only input", async () => {
    const entry = seedMixed()
    const onDone = vi.fn()
    render(<PostSessionForm initialEntry={entry} onDone={onDone} />)
    fireEvent.change(screen.getByLabelText("거리 (km)"), { target: { value: "99" } })
    await userEvent.setup().click(screen.getByRole("button", { name: /수정 저장/u }))
    expect(onDone).not.toHaveBeenCalled()
    expect(stored()).toEqual(entry)
  })

  it("requires selection of the exact AM/PM reconciliation target", async () => {
    const am = waitingJournal()
    const pm = waitingJournal({ id: "synthetic-pm", activitySlot: "PM" })
    expect(saveEntry(am).ok).toBe(true)
    expect(saveEntry(pm).ok).toBe(true)
    render(<ReviewHarness draft={buildImportDrafts([watchActivity])[0]!} />)
    const user = userEvent.setup()
    expect(screen.getByRole("checkbox")).not.toBeChecked()
    await user.click(screen.getByRole("checkbox"))
    expect(screen.getByRole("button", { name: "저장 방식을 골라 주세요" })).toBeDisabled()
    expect(screen.getByRole("combobox")).toHaveValue("")
    await user.selectOptions(screen.getByRole("combobox"), pm.id)
    expect(loadEntries()).toEqual([am, pm])
    await user.click(screen.getByRole("button", { name: "고른 1건 일지에 저장" }))
    expect(loadEntries().find((entry) => entry.id === am.id)).toEqual(am)
    expect(loadEntries().find((entry) => entry.id === pm.id)).toMatchObject({ distanceKm: "5.00" })
  })

  it("P2-3 offers save-separate for a suspected duplicate", async () => {
    const original = toImportedEntry(watchActivity, "csv")
    expect(saveEntry(original).ok).toBe(true)
    render(<ReviewHarness draft={buildImportDrafts([watchActivity])[0]!} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("checkbox"))
    await user.selectOptions(screen.getByRole("combobox"), "separate")
    await user.click(screen.getByRole("button", { name: "고른 1건 일지에 저장" }))
    expect(loadEntries()).toHaveLength(2)
    expect(loadEntries()[0]).toEqual(original)
  })
})
