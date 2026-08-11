import { BetaAccountSettings } from "./BetaAccountSettings"
import { CoachSupportPanel } from "./CoachSupportPanel"
import { PrivateMemoVault } from "./PrivateMemoVault"
import { GuardianConfirmationPanel } from "./GuardianConfirmationPanel"
import { ProductAnalyticsConsentPanel } from "./ProductAnalyticsConsentPanel"
import { productFeatures } from "../../domain/product-features"
import type { AccountLegalDocument } from "../../domain/account/config"

export function AccountNetworkSettings({
  userId,
  today,
  legalDocuments,
  initialPrivacyAcknowledged,
  initialTermsAcknowledged,
}: {
  readonly userId: string
  readonly today: string
  readonly legalDocuments: {
    readonly privacyPolicy: AccountLegalDocument
    readonly termsOfService: AccountLegalDocument
  }
  readonly initialPrivacyAcknowledged?: boolean
  readonly initialTermsAcknowledged?: boolean
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
      />
      {features.productAnalytics && <ProductAnalyticsConsentPanel userId={userId} />}
      {(features.sync || features.sharing) && <GuardianConfirmationPanel userId={userId} />}
      {features.sync && <PrivateMemoVault />}
      {features.sharing && <CoachSupportPanel userId={userId} today={today} />}
    </>
  )
}
