import React from "react"
import { AppShell, useIsMobileShell } from "./AppShell"
import { productFeatures } from "./domain/product-features"
import { AppLoadingState } from "./components/AppLoadingState"

const DesktopWorkspace = React.lazy(() => import("./DesktopWorkspace"))
const PublicProfilePage = React.lazy(async () => {
  const module = await import("./screens/PublicProfilePage")
  return { default: module.PublicProfilePage }
})

export default function App() {
  const publicProfileHandle = typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get("profile")
  if (publicProfileHandle !== null && productFeatures().publicProfile) {
    return (
      <React.Suspense fallback={<AppLoadingState fullScreen label="공개 프로필을 준비하고 있어요." />}>
        <PublicProfilePage handle={publicProfileHandle} />
      </React.Suspense>
    )
  }
  const appShell = useIsMobileShell()
  if (appShell) return <AppShell />
  return (
    <React.Suspense fallback={<AppLoadingState fullScreen />}>
      <DesktopWorkspace />
    </React.Suspense>
  )
}
