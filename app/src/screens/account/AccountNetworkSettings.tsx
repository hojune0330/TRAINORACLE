import { BetaAccountSettings } from "./BetaAccountSettings"
import { CoachSupportPanel } from "./CoachSupportPanel"
import { PrivateMemoVault } from "./PrivateMemoVault"
import { GuardianConfirmationPanel } from "./GuardianConfirmationPanel"
import { productFeatures } from "../../domain/product-features"

export function AccountNetworkSettings({ userId, today }: {
  readonly userId: string
  readonly today: string
}) {
  const features = productFeatures()
  return (
    <>
      <BetaAccountSettings userId={userId} today={today} />
      {(features.sync || features.sharing) && <GuardianConfirmationPanel userId={userId} />}
      {features.sync && <PrivateMemoVault />}
      {features.sharing && <CoachSupportPanel userId={userId} today={today} />}
    </>
  )
}
