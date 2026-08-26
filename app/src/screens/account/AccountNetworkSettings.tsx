import { BetaAccountSettings } from "./BetaAccountSettings"
import { CoachSupportPanel } from "./CoachSupportPanel"
import { ProductAnalyticsConsentPanel } from "./ProductAnalyticsConsentPanel"
import { productFeatures } from "../../domain/product-features"
import type { AccountLegalDocument } from "../../domain/account/config"

export function AccountNetworkSettings({
  userId,
  today,
  legalDocuments,
  initialPrivacyAcknowledged,
  initialTermsAcknowledged,
  profileSetupComplete = false,
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
      />
      {features.productAnalytics && <ProductAnalyticsConsentPanel userId={userId} />}
      {features.sharing && <CoachSupportPanel userId={userId} today={today} />}
    </>
  )
}
