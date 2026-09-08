import React from "react"
import { AppShell, useIsMobileShell, type AppShellMultiPlanRuntime } from "./AppShell"
import { productFeatures } from "./domain/product-features"
import { AppLoadingState } from "./components/AppLoadingState"
import { useAccountJournalRuntime } from "./domain/account/useAccountJournalRuntime"
import { AccountJournalStorageStatus } from "./components/AccountJournalStorageStatus"

const DesktopWorkspace = React.lazy(() => import("./DesktopWorkspace"))
const PublicProfilePage = React.lazy(async () => {
  const module = await import("./screens/PublicProfilePage")
  return { default: module.PublicProfilePage }
})

export default function App({ multiPlanRuntime }: { readonly multiPlanRuntime?: AppShellMultiPlanRuntime } = {}) {
  const publicProfileHandle = typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get("profile")
  useAccountJournalRuntime(publicProfileHandle === null)
  if (publicProfileHandle !== null && productFeatures().publicProfile) {
    return (
      <React.Suspense fallback={<AppLoadingState fullScreen label="공개 프로필을 준비하고 있어요." />}>
        <PublicProfilePage handle={publicProfileHandle} />
      </React.Suspense>
    )
  }
  const appShell = useIsMobileShell()
  if (appShell) return <><AccountJournalStorageStatus /><AppShell multiPlanRuntime={multiPlanRuntime} /></>
  return (
    <><AccountJournalStorageStatus />
    <React.Suspense fallback={<AppLoadingState fullScreen />}>
      <DesktopWorkspace />
    </React.Suspense>
    </>
  )
}
