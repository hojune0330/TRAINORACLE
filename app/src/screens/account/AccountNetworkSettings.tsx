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
      <BetaAccountSettings
        userId={userId}
        today={today}
        legalDocuments={legalDocuments}
        initialPrivacyAcknowledged={initialPrivacyAcknowledged}
        initialTermsAcknowledged={initialTermsAcknowledged}
        profileSetupComplete={profileSetupComplete}
        onDeletionCompleted={onDeletionCompleted}
      />
      {profileSetupComplete && <StorageConsentPanel key={userId} userId={userId} />}
      <AccountDataRightsPanel key={`rights-${userId}`} userId={userId} />
      {features.planBackup && <PlanCloudBackupNotice />}
      {features.productAnalytics && <ProductAnalyticsConsentPanel userId={userId} />}
      {features.publicProfile && <PublicProfileSettings userId={userId} />}
      {features.sharing && <CoachSupportPanel userId={userId} today={today} />}
    </>
  )
}
