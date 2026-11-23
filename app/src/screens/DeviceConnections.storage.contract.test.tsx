import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { syntheticGarminOwner as owner, syntheticGarminStatus } from "../components/GarminConnectionPanel.test-fixtures"
import { loadAccountStorageConsent, saveAccountStorageConsent, STORAGE_CONSENT_VERSION, type StorageConsent } from "../domain/account/storage-consent"
import { requestGarminIntegration } from "../domain/account/garmin-integration"
import { DeviceConnections } from "./DeviceConnections"

vi.mock("../domain/account/storage-consent", async original => ({
  ...await original<typeof import("../domain/account/storage-consent")>(),
  loadAccountStorageConsent: vi.fn(), saveAccountStorageConsent: vi.fn(),
}))
vi.mock("../domain/account/garmin-integration", async original => ({
  ...await original<typeof import("../domain/account/garmin-integration")>(),
  garminEndpoint: () => "https://example.invalid", garminIntegrationEnabled: () => true,
  requestGarminIntegration: vi.fn(),
}))
vi.mock("../domain/account/account-journal-api", async original => ({
  ...await original<typeof import("../domain/account/account-journal-api")>(),
  accountJournalPreviewEnabled: () => true,
}))

const receipt: StorageConsent = { userId: owner, revision: 1, purposeVersion: STORAGE_CONSENT_VERSION, healthStorage: false, journalTextStorage: false, decidedAt: null, operationsReady: true, liveErasedAt: null, backupStatus: null }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(loadAccountStorageConsent).mockResolvedValue({ ok: true, consent: receipt })
  vi.mocked(requestGarminIntegration).mockResolvedValue({ ok: true, data: {
    ...syntheticGarminStatus, connection: { state: "DISCONNECTED", epoch: null, lastSyncAt: null }, pendingCount: 0,
  } })
})
afterEach(cleanup)

describe("watch connection outside account settings", () => {
  it("opens both storage choices on the same screen and returns to the Garmin action only after saving", async () => {
    vi.mocked(saveAccountStorageConsent).mockResolvedValue({ ok: true, consent: { ...receipt, revision: 2, healthStorage: true, journalTextStorage: true } })
    render(<DeviceConnections ownerId={owner} />)
    fireEvent.click(await screen.findByRole("button", { name: "기록 보관 설정 확인" }))
    const save = screen.getByRole("button", { name: "선택한 동의 저장" })
    fireEvent.click(screen.getByRole("checkbox", { name: /건강정보의 계정/ }))
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: /메모·글의 계정/ }))
    expect(requestGarminIntegration).not.toHaveBeenCalled()
    fireEvent.click(save)
    expect(await screen.findByRole("button", { name: "동의하고 Garmin 연결" })).toBeEnabled()
    expect(saveAccountStorageConsent).toHaveBeenCalledWith(receipt, true, true)
    expect(vi.mocked(requestGarminIntegration).mock.calls.map(([, req]) => req.action)).toEqual(["status"])
    expect(screen.queryByRole("checkbox", { name: /건강정보의 계정/ })).not.toBeInTheDocument()
  })

  it("allows leaving before saving and delegates to the existing account form when supplied", async () => {
    const openAccountStorage = vi.fn()
    const { rerender } = render(<DeviceConnections ownerId={owner} />)
    fireEvent.click(await screen.findByRole("button", { name: "기록 보관 설정 확인" }))
    fireEvent.click(screen.getByRole("button", { name: "워치 연결로 돌아가기" }))
    expect(screen.getByRole("button", { name: "기록 보관 설정 확인" })).toBeEnabled()
    expect(saveAccountStorageConsent).not.toHaveBeenCalled()
    rerender(<DeviceConnections ownerId={owner} inlineSetup storageReadiness="required" onOpenStorageSettings={openAccountStorage} />)
    fireEvent.click(screen.getByRole("button", { name: "기록 보관 설정 확인" }))
    expect(openAccountStorage).toHaveBeenCalledOnce()
    expect(loadAccountStorageConsent).toHaveBeenCalledTimes(1)
    expect(requestGarminIntegration).not.toHaveBeenCalled()
  })
})
