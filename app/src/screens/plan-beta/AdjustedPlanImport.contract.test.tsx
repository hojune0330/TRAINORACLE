import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { AdjustedPlanImport } from "./AdjustedPlanImport"
import { adjustedSuccessorFixture } from "../../domain/adjusted-plan-successor.test-fixtures"
import { exportAdjustedPlanBackup } from "../../domain/adjusted-plan-backup"
import { activePlanBetaStorageKey } from "../../domain/plan-beta-store"
import { readAdjustedOriginalPlans } from "../../domain/adjusted-plan-archive"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
it("shows the file count and requires confirmation before the real historical import", async () => {
  const { old, retained, now, input } = await adjustedSuccessorFixture(date => vi.setSystemTime(date))
  const file = exportAdjustedPlanBackup(old.state.contentFingerprint, retained, now)
  if (file.kind !== "exported") throw Error("Expected file")
  localStorage.removeItem(activePlanBetaStorageKey())
  render(<AdjustedPlanImport readEvidence={() => retained} locks={input.locks} onBack={vi.fn()} />)
  await act(async () => { fireEvent.change(screen.getByLabelText("개인 보관용 계획 파일"), {
    target: { files: [{ size: file.raw.length, text: async () => file.raw }] } }) })
  expect(screen.getByRole("button", { name: "과거 원본 보관함에 추가" })).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox"))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "과거 원본 보관함에 추가" })) })
  expect(screen.getByRole("status")).toHaveTextContent("원본 1개를 추가했어요")
  expect(readAdjustedOriginalPlans(retained)).toMatchObject({ kind: "loaded", entries: [{ state: old.state }] })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})
