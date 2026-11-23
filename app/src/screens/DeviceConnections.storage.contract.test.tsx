import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { syntheticGarminOwner as owner, syntheticGarminStatus } from "../components/GarminConnectionPanel.test-fixtures"
import { isAccountStoragePaused, loadAccountStorageConsent, saveAccountStorageConsent, STORAGE_CONSENT_VERSION, type StorageConsent, type StorageConsentResult } from "../domain/account/storage-consent"
import { requestGarminIntegration } from "../domain/account/garmin-integration"
import { DeviceConnections } from "./DeviceConnections"

vi.mock("../domain/account/storage-consent", async original => ({
  ...await original<typeof import("../domain/account/storage-consent")>(),
  loadAccountStorageConsent: vi.fn(), saveAccountStorageConsent: vi.fn(), isAccountStoragePaused: vi.fn(),
}))
vi.mock("../domain/account/garmin-integration", async original => ({
  ...await original<typeof import("../domain/account/garmin-integration")>(),
  garminEndpoint: () => "https://example.invalid", garminIntegrationEnabled: () => true,
  requestGarminIntegration: vi.fn(),
}))

const receipt: StorageConsent = { userId: owner, revision: 1, purposeVersion: STORAGE_CONSENT_VERSION, healthStorage: false, journalTextStorage: false, decidedAt: null, operationsReady: true, liveErasedAt: null, backupStatus: null }
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true")
  vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
  vi.mocked(isAccountStoragePaused).mockReturnValue(false)
  vi.mocked(loadAccountStorageConsent).mockResolvedValue({ ok: true, consent: receipt })
  vi.mocked(requestGarminIntegration).mockResolvedValue({ ok: true, data: {
    ...syntheticGarminStatus, connection: { state: "DISCONNECTED", epoch: null, lastSyncAt: null }, pendingCount: 0,
  } })
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe("watch connection outside account settings", () => {
  it("offers the consent form before the account is eligible to transmit", async () => {
    vi.mocked(isAccountStoragePaused).mockReturnValue(true)
    render(<DeviceConnections ownerId={owner} />)
    fireEvent.click(await screen.findByRole("button", { name: "기록 보관 설정 확인" }))
    expect(screen.getByRole("checkbox", { name: /건강정보의 계정/ })).toBeEnabled()
    expect(requestGarminIntegration).not.toHaveBeenCalled()
  })

  it("keeps the same consent read through a parent render during verification", async () => {
    let finish!: (value: StorageConsentResult) => void
    vi.mocked(loadAccountStorageConsent).mockImplementation(() => {
      vi.mocked(isAccountStoragePaused).mockReturnValue(true)
      return new Promise(resolve => { finish = resolve })
    })
    const { rerender } = render(<DeviceConnections ownerId={owner} />)
    rerender(<DeviceConnections ownerId={owner} />)
    expect(screen.getByText("기록 보관 상태를 확인하고 있어요")).toBeVisible()
    expect(requestGarminIntegration).not.toHaveBeenCalled()
    vi.mocked(isAccountStoragePaused).mockReturnValue(false)
    await act(async () => finish({ ok:true, consent:{ ...receipt, healthStorage:true, journalTextStorage:true } }))
    expect(await screen.findByRole("button", { name:"동의하고 Garmin 연결" })).toBeDisabled()
    expect(loadAccountStorageConsent).toHaveBeenCalledTimes(1)
    expect(vi.mocked(requestGarminIntegration).mock.calls.map(([,req]) => req.action)).toEqual(["status"])
  })

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
    const connect = await screen.findByRole("button", { name: "동의하고 Garmin 연결" })
    const acknowledgement = screen.getByRole("checkbox", { name: "자동으로 가져오는 운동 범위를 확인했어요" })
    expect(acknowledgement).not.toBeChecked()
    expect(connect).toBeDisabled()
    fireEvent.click(acknowledgement)
    expect(connect).toBeEnabled()
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
