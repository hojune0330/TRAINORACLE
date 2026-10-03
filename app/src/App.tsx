import React from "react"
import { AppShell, useIsMobileShell, type AppShellMultiPlanRuntime } from "./AppShell"
import { productFeatures } from "./domain/product-features"
import { AppLoadingState } from "./components/AppLoadingState"
import { useAccountJournalRuntime } from "./domain/account/useAccountJournalRuntime"
import { AccountJournalStorageStatus } from "./components/AccountJournalStorageStatus"
import { InstallShortcutProvider } from "./components/InstallShortcut"
import { useAccountAthleteRecordsRuntime } from "./domain/account/useAccountAthleteRecordsRuntime"

const DesktopWorkspace = React.lazy(() => import("./DesktopWorkspace"))
const PublicProfilePage = React.lazy(async () => {
  const module = await import("./screens/PublicProfilePage")
  return { default: module.PublicProfilePage }
})

export default function App({ multiPlanRuntime }: { readonly multiPlanRuntime?: AppShellMultiPlanRuntime } = {}) {
  const publicProfileHandle = typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get("profile")
  const publicEntry = publicProfileHandle !== null && productFeatures().publicProfile
  useAccountJournalRuntime(!publicEntry)
  useAccountAthleteRecordsRuntime()
  const appShell = useIsMobileShell()
  if (publicEntry) {
    return (
      <React.Suspense fallback={<AppLoadingState fullScreen label="공개 프로필을 준비하고 있어요." />}>
        <PublicProfilePage handle={publicProfileHandle} />
      </React.Suspense>
    )
  }
  if (appShell) return <InstallShortcutProvider><AccountJournalStorageStatus /><AppShell multiPlanRuntime={multiPlanRuntime} /></InstallShortcutProvider>
  return (
    <InstallShortcutProvider><AccountJournalStorageStatus />
    <React.Suspense fallback={<AppLoadingState fullScreen />}>
      <DesktopWorkspace multiPlanRuntime={multiPlanRuntime} />
    </React.Suspense>
    </InstallShortcutProvider>
  )
}
