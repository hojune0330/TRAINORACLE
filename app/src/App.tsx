import React from "react"
import { AppShell, useIsMobileShell } from "./AppShell"

const DesktopWorkspace = React.lazy(() => import("./DesktopWorkspace"))

export default function App() {
  const appShell = useIsMobileShell()
  if (appShell) return <AppShell />
  return (
    <React.Suspense fallback={<p role="status">화면을 불러오는 중이에요.</p>}>
      <DesktopWorkspace />
    </React.Suspense>
  )
}
