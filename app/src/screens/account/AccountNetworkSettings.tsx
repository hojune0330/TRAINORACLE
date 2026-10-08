import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import { BetaAccountSettings } from "./BetaAccountSettings"
import { CoachSupportPanel } from "./CoachSupportPanel"
import { ProductAnalyticsConsentPanel } from "./ProductAnalyticsConsentPanel"
import { productFeatures } from "../../domain/product-features"
import type { AccountLegalDocument } from "../../domain/account/config"
import type { AccountActionResult } from "../../domain/account/account-service"
import { PublicProfileSettings } from "./PublicProfileSettings"
import { PlanCloudBackupNotice } from "./PlanCloudBackupNotice"
import { StorageConsentPanel } from "./StorageConsentPanel"
import { AccountDataRightsPanel } from "./AccountDataRightsPanel"

function disclosureStatus(root: HTMLElement) {
  const needsAttention = root.matches('[role="alert"], [data-state="error"], [data-state="warning"], [data-state="conflict"]')
    || root.querySelector('[role="alert"], [data-state="error"], [data-state="warning"], [data-state="conflict"]') !== null
  const isBusy = root.matches('[aria-busy="true"], [data-state="pending"]')
    || root.querySelector('[aria-busy="true"], [data-state="pending"]') !== null
  const hasStatus = root.matches('[role="status"]') || root.querySelector('[role="status"]') !== null
  return [needsAttention ? "확인 필요" : null, isBusy ? "진행 중" : null, hasStatus && !needsAttention && !isBusy ? "알림 확인" : null]
    .filter((value): value is string => value !== null)
    .join(" · ")
}

/** Keep async panels mounted while closed and summarize only their semantic status, never message text. */
export function AccountSettingsDisclosure({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState("")

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const refresh = () => {
      const nextPreview = disclosureStatus(container)
      setPreview(current => current === nextPreview ? current : nextPreview)
    }
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-busy", "data-state", "role"],
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef}>
      <InfoDisclosure title={title} purpose="actions" preview={preview || undefined}>
        {children}
      </InfoDisclosure>
    </div>
  )
}

export function AccountNetworkSettings({
  userId,
  today,
  legalDocuments,
  initialPrivacyAcknowledged,
  initialTermsAcknowledged,
  profileSetupComplete = false,
  onDeletionCompleted,
}: {
  readonly userId: string
  readonly today: string
  readonly legalDocuments: {
    readonly privacyPolicy: AccountLegalDocument
    readonly termsOfService: AccountLegalDocument
  }
  readonly initialPrivacyAcknowledged?: boolean
  readonly initialTermsAcknowledged?: boolean
  readonly profileSetupComplete?: boolean
  readonly onDeletionCompleted?: (() => AccountActionResult | Promise<AccountActionResult>) | undefined
}) {
  const features = productFeatures()
  return (
    <>
      {profileSetupComplete ? (
        <AccountSettingsDisclosure title="프로필·계정">
          <BetaAccountSettings
            userId={userId}
            today={today}
            legalDocuments={legalDocuments}
            initialPrivacyAcknowledged={initialPrivacyAcknowledged}
            initialTermsAcknowledged={initialTermsAcknowledged}
            profileSetupComplete={profileSetupComplete}
            onDeletionCompleted={onDeletionCompleted}
          />
        </AccountSettingsDisclosure>
      ) : (
        <BetaAccountSettings
          userId={userId}
          today={today}
          legalDocuments={legalDocuments}
          initialPrivacyAcknowledged={initialPrivacyAcknowledged}
          initialTermsAcknowledged={initialTermsAcknowledged}
          profileSetupComplete={profileSetupComplete}
          onDeletionCompleted={onDeletionCompleted}
        />
      )}
      {profileSetupComplete && (
        <AccountSettingsDisclosure title="온라인 보관">
          <StorageConsentPanel key={userId} userId={userId} />
        </AccountSettingsDisclosure>
      )}
      <AccountSettingsDisclosure title="내 자료·백업">
        <AccountDataRightsPanel key={`rights-${userId}`} userId={userId} />
        {features.planBackup && <PlanCloudBackupNotice />}
      </AccountSettingsDisclosure>
      {(features.productAnalytics || features.publicProfile || features.sharing) && (
        <AccountSettingsDisclosure title="공유·동의">
          {features.productAnalytics && <ProductAnalyticsConsentPanel userId={userId} />}
          {features.publicProfile && <PublicProfileSettings userId={userId} />}
          {features.sharing && <CoachSupportPanel userId={userId} today={today} />}
        </AccountSettingsDisclosure>
      )}
    </>
  )
}
