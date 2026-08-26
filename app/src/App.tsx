import React from "react"
import { AppShell, useIsMobileShell } from "./AppShell"
import { productFeatures } from "./domain/product-features"

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
      <React.Suspense fallback={<p role="status" style={{ padding: 24 }}>공개 프로필을 준비하고 있어요.</p>}>
        <PublicProfilePage handle={publicProfileHandle} />
      </React.Suspense>
    )
  }
  const appShell = useIsMobileShell()
  if (appShell) return <AppShell />
  return (
    <React.Suspense fallback={<p role="status">화면을 불러오는 중이에요.</p>}>
      <DesktopWorkspace />
    </React.Suspense>
  )
}
