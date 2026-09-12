import React, { type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  BadgeCheck,
  Download,
  MonitorDown,
  Share2,
  Smartphone,
  X,
} from "lucide-react"
import "./InstallShortcut.css"

// Browser capability and manual-path references:
// MDN: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event
// Apple iPhone/iPad: https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios
// Apple Mac Safari (macOS Sonoma 14+): https://support.apple.com/en-gb/104996
// Chrome: https://support.google.com/chrome/answer/9658361
// Edge: https://support.microsoft.com/en-us/microsoft-edge/install-manage-or-uninstall-apps-in-microsoft-edge-0c156575-a94a-45e4-a54f-3a84846f6113

const STORAGE_KEY = "trainoracle:install-shortcut:v1"
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000

type InstallChoice = {
  readonly outcome: "accepted" | "dismissed"
  readonly platform: string
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  readonly userChoice: Promise<InstallChoice>
}

type NavigatorWithInstallHints = Navigator & {
  readonly standalone?: boolean
  readonly userAgentData?: {
    readonly mobile?: boolean
  }
}

type PromptState = "idle" | "accepted-pending" | "dismissed" | "failed"

type BrowserGuide = {
  readonly kind: "ios" | "android" | "desktop-chromium" | "mac-safari" | "in-app" | "generic"
  readonly mobile: boolean
  readonly title: string
  readonly intro: string
  readonly steps: readonly string[]
}

type InstallShortcutContextValue = {
  readonly installed: boolean
  readonly dismissed: boolean
  readonly nativeAvailable: boolean
  readonly busy: boolean
  readonly promptState: PromptState
  readonly guide: BrowserGuide
  readonly openDialog: (opener: HTMLElement, returnFocusTo?: () => HTMLElement | null) => void
  readonly closeDialog: () => void
  readonly dismissSuggestion: () => void
  readonly requestNativeInstall: () => void
}

const InstallShortcutContext = React.createContext<InstallShortcutContextValue | null>(null)

let memoryDismissedAt: number | null = null

function validDismissedAt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  const age = Date.now() - value
  return age >= 0 && age < DISMISS_FOR_MS ? value : null
}

function readDismissedAt(): number | null {
  if (typeof window === "undefined") return validDismissedAt(memoryDismissedAt)
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    return validDismissedAt(Number(raw))
  } catch {
    return validDismissedAt(memoryDismissedAt)
  }
}

function rememberDismissal(): number {
  const dismissedAt = Date.now()
  memoryDismissedAt = dismissedAt
  try {
    window.localStorage.setItem(STORAGE_KEY, String(dismissedAt))
  } catch {
    // The current provider state remains the preference source when storage is unavailable.
  }
  return dismissedAt
}

function navigatorHints(): NavigatorWithInstallHints | null {
  return typeof navigator === "undefined" ? null : navigator as NavigatorWithInstallHints
}

function standaloneMediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null
  try {
    return window.matchMedia("(display-mode: standalone)")
  } catch {
    return null
  }
}

function standaloneObserved(query = standaloneMediaQuery()): boolean {
  return query?.matches === true || navigatorHints()?.standalone === true
}

function detectBrowserGuide(): BrowserGuide {
  const hints = navigatorHints()
  const userAgent = hints?.userAgent ?? ""
  const platform = hints?.platform ?? ""
  const touchPoints = hints?.maxTouchPoints ?? 0
  const ios = /iPhone|iPad|iPod/iu.test(userAgent)
    || (platform === "MacIntel" && touchPoints > 1)
  const android = /Android/iu.test(userAgent)
  const mobile = hints?.userAgentData?.mobile === true || ios || android || /Mobile/iu.test(userAgent)
  const inApp = /FBAN|FBAV|Instagram|KAKAOTALK|Line\/|NAVER|Twitter|;\s*wv\)/iu.test(userAgent)

  if (inApp) {
    const browser = ios ? "Safari" : android ? "Chrome 또는 Edge" : "Safari 또는 Chrome"
    return {
      kind: "in-app",
      mobile,
      title: "먼저 기본 브라우저에서 열어 주세요",
      intro: `현재 앱 안 브라우저에서는 바로가기를 만들 수 없을 수 있어요. 공유 또는 메뉴에서 ${browser}로 연 뒤 진행해 주세요.`,
      steps: [
        `현재 화면의 공유 또는 더보기 메뉴에서 ${browser}로 열기`,
        "열린 브라우저의 홈 화면 추가, 앱 설치 또는 북마크 메뉴 선택",
      ],
    }
  }

  if (ios) {
    return {
      kind: "ios",
      mobile: true,
      title: "Safari에서 홈 화면에 추가",
      intro: "iPhone과 iPad에서는 Safari 공유 메뉴에서 바로가기를 만들 수 있어요.",
      steps: [
        "Safari에서 이 페이지 열기",
        "도구 막대의 공유 버튼 누르기",
        "홈 화면에 추가를 선택한 뒤 추가 누르기",
      ],
    }
  }

  if (android) {
    return {
      kind: "android",
      mobile: true,
      title: "브라우저 메뉴에서 홈 화면에 추가",
      intro: "Android의 Chrome 또는 Edge 메뉴에서 설치 항목을 확인해 주세요.",
      steps: [
        "오른쪽 위 더보기 메뉴 열기",
        "홈 화면에 추가 또는 앱 설치 선택",
        "표시되는 확인 화면에서 추가 또는 설치 선택",
      ],
    }
  }

  const edge = /Edg\//iu.test(userAgent)
  const chromium = edge || /Chrome|Chromium/iu.test(userAgent)
  if (chromium) {
    return {
      kind: "desktop-chromium",
      mobile: false,
      title: edge ? "Edge에서 앱으로 설치" : "Chrome에서 앱 바로가기 만들기",
      intro: "주소창의 설치 아이콘이나 브라우저 메뉴에서 앱 설치 항목을 확인해 주세요.",
      steps: edge
        ? ["설정 및 기타 메뉴 열기", "앱에서 이 사이트를 앱으로 설치 선택", "표시되는 확인 화면에서 설치 선택"]
        : ["주소창 오른쪽의 설치 아이콘 선택", "아이콘이 없으면 브라우저 메뉴에서 설치 항목 확인", "표시되는 확인 화면에서 설치 선택"],
    }
  }

  const macSafari = /Mac/iu.test(platform || userAgent)
    && /Safari/iu.test(userAgent)
    && !/Chrome|Chromium|CriOS|Edg/iu.test(userAgent)
  if (macSafari) {
    return {
      kind: "mac-safari",
      mobile: false,
      title: "Safari에서 Dock에 추가",
      intro: "macOS Sonoma 14 이상에서는 Safari가 이 사이트를 Dock의 웹 앱으로 추가할 수 있어요.",
      steps: ["Safari의 파일 메뉴 열기", "Dock에 추가 선택", "이름을 확인한 뒤 추가 선택"],
    }
  }

  return {
    kind: "generic",
    mobile,
    title: mobile ? "브라우저 북마크로 저장" : "브라우저 바로가기로 저장",
    intro: "이 브라우저에서는 앱 설치 기능을 확인할 수 없어요. 북마크나 즐겨찾기로 빠르게 다시 열 수 있어요.",
    steps: ["브라우저의 북마크 또는 즐겨찾기 메뉴 열기", "현재 페이지 추가 선택"],
  }
}

export function InstallShortcutProvider({ children }: { readonly children: ReactNode }) {
  const [installed, setInstalled] = React.useState(() => standaloneObserved())
  const [dismissedAt, setDismissedAt] = React.useState<number | null>(() => readDismissedAt())
  const [nativeAvailable, setNativeAvailable] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [promptState, setPromptState] = React.useState<PromptState>("idle")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const guide = React.useMemo(() => detectBrowserGuide(), [])
  const deferredPrompt = React.useRef<BeforeInstallPromptEvent | null>(null)
  const busyRef = React.useRef(false)
  const installedRef = React.useRef(installed)
  const openerRef = React.useRef<HTMLElement | null>(null)
  const returnFocusToRef = React.useRef<(() => HTMLElement | null) | undefined>(undefined)
  installedRef.current = installed

  const markInstalled = React.useCallback(() => {
    installedRef.current = true
    deferredPrompt.current = null
    setInstalled(true)
    setNativeAvailable(false)
    setBusy(false)
    busyRef.current = false
    setPromptState("idle")
  }, [])

  React.useEffect(() => {
    const query = standaloneMediaQuery()
    const onStandaloneChange = () => {
      if (standaloneObserved(query)) markInstalled()
    }
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      if (installedRef.current) return
      deferredPrompt.current = event as BeforeInstallPromptEvent
      setNativeAvailable(true)
      setPromptState("idle")
    }

    onStandaloneChange()
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", markInstalled)
    if (typeof query?.addEventListener === "function") query.addEventListener("change", onStandaloneChange)
    else query?.addListener?.(onStandaloneChange)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", markInstalled)
      if (typeof query?.removeEventListener === "function") query.removeEventListener("change", onStandaloneChange)
      else query?.removeListener?.(onStandaloneChange)
      deferredPrompt.current = null
    }
  }, [markInstalled])

  React.useEffect(() => {
    if (dismissedAt === null) return
    const remaining = DISMISS_FOR_MS - (Date.now() - dismissedAt)
    if (remaining <= 0) {
      setDismissedAt(null)
      return
    }
    const timeout = window.setTimeout(() => setDismissedAt(null), remaining)
    return () => window.clearTimeout(timeout)
  }, [dismissedAt])

  const openDialog = React.useCallback((opener: HTMLElement, returnFocusTo?: () => HTMLElement | null) => {
    openerRef.current = opener
    returnFocusToRef.current = returnFocusTo
    setDialogOpen(true)
  }, [])

  const closeDialog = React.useCallback(() => setDialogOpen(false), [])

  const dismissSuggestion = React.useCallback(() => {
    setDismissedAt(rememberDismissal())
  }, [])

  const requestNativeInstall = React.useCallback(() => {
    if (busyRef.current) return
    const prompt = deferredPrompt.current
    if (prompt === null) return

    busyRef.current = true
    deferredPrompt.current = null
    setNativeAvailable(false)
    setBusy(true)
    setPromptState("idle")

    void (async () => {
      try {
        await prompt.prompt()
        const choice = await prompt.userChoice
        if (choice.outcome === "accepted") {
          setPromptState("accepted-pending")
        } else {
          setDismissedAt(rememberDismissal())
          setPromptState("dismissed")
        }
      } catch {
        setPromptState("failed")
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    })()
  }, [])

  const dismissed = validDismissedAt(dismissedAt) !== null
  const value = React.useMemo<InstallShortcutContextValue>(() => ({
    installed,
    dismissed,
    nativeAvailable,
    busy,
    promptState,
    guide,
    openDialog,
    closeDialog,
    dismissSuggestion,
    requestNativeInstall,
  }), [
    busy,
    closeDialog,
    dismissSuggestion,
    dismissed,
    guide,
    installed,
    nativeAvailable,
    openDialog,
    promptState,
    requestNativeInstall,
  ])

  return (
    <InstallShortcutContext.Provider value={value}>
      {children}
      {dialogOpen && typeof document !== "undefined" && createPortal(
        <InstallShortcutDialog
          controller={value}
          opener={openerRef.current}
          returnFocusTo={returnFocusToRef.current}
        />,
        document.body,
      )}
    </InstallShortcutContext.Provider>
  )
}

export function InstallShortcutSuggestion({
  eligible,
  returnFocusTo,
}: {
  readonly eligible: boolean
  readonly returnFocusTo?: () => HTMLElement | null
}) {
  const titleId = React.useId()
  const controller = React.useContext(InstallShortcutContext)
  if (controller === null || !eligible || controller.dismissed || controller.installed) return null

  const label = controller.guide.mobile ? "홈 화면에 추가" : "앱 바로가기 만들기"
  return (
    <section
      className="install-shortcut-suggestion"
      data-testid="install-shortcut-suggestion"
      aria-labelledby={titleId}
    >
      <Smartphone className="install-shortcut-suggestion__icon" size={20} aria-hidden="true" />
      <div className="install-shortcut-suggestion__copy">
        <span>빠른 실행</span>
        <h2 id={titleId}>{label}</h2>
        <p>브라우저를 찾지 않고 TrainOracle을 바로 열 수 있어요.</p>
      </div>
      <button
        type="button"
        className="install-shortcut-suggestion__dismiss"
        data-testid="install-shortcut-dismiss"
        aria-label="바로가기 제안을 7일 동안 닫기"
        title="7일 동안 닫기"
        onClick={controller.dismissSuggestion}
      >
        <X size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="install-shortcut-suggestion__open"
        onClick={(event) => controller.openDialog(event.currentTarget, returnFocusTo)}
      >
        추가 방법 보기
      </button>
    </section>
  )
}

export function InstallShortcutMenuEntry() {
  const controller = React.useContext(InstallShortcutContext)
  if (controller === null) return null

  const label = controller.guide.mobile ? "홈 화면에 추가" : "앱 바로가기 만들기"
  const Icon = controller.installed ? BadgeCheck : controller.guide.mobile ? Smartphone : MonitorDown
  return (
    <button
      className="more-screen__row install-shortcut-menu"
      type="button"
      data-testid="install-shortcut-menu"
      aria-label={label}
      onClick={(event) => controller.openDialog(event.currentTarget)}
    >
      <Icon aria-hidden="true" size={19} />
      <span>
        <strong>{label}</strong>
        <small>
          {controller.installed
            ? "이 브라우저에서는 바로가기 아이콘을 이미 사용 중이에요"
            : "브라우저에 맞는 추가 방법을 확인해요"}
        </small>
      </span>
    </button>
  )
}

function InstallShortcutDialog({
  controller,
  opener,
  returnFocusTo,
}: {
  readonly controller: InstallShortcutContextValue
  readonly opener: HTMLElement | null
  readonly returnFocusTo?: () => HTMLElement | null
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const titleId = React.useId()
  const descriptionId = React.useId()
  const label = controller.guide.mobile ? "홈 화면에 추가" : "앱 바로가기 만들기"

  React.useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal()
      else dialog.setAttribute("open", "")
    }
    closeRef.current?.focus()

    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close()
      else dialog.removeAttribute("open")
      document.body.style.overflow = previousOverflow
      let focusTarget = opener?.isConnected ? opener : null
      if (focusTarget === null) {
        try {
          const fallback = returnFocusTo?.() ?? null
          focusTarget = fallback?.isConnected ? fallback : null
        } catch {
          focusTarget = null
        }
      }
      focusTarget?.focus({ preventScroll: true })
    }
  }, [opener, returnFocusTo])

  return (
    <dialog
      ref={dialogRef}
      className="install-shortcut-dialog"
      data-testid="install-shortcut-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={controller.busy}
      onCancel={(event) => {
        event.preventDefault()
        controller.closeDialog()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) controller.closeDialog()
      }}
    >
      <header className="install-shortcut-dialog__header">
        <div className="install-shortcut-dialog__heading">
          {controller.installed
            ? <BadgeCheck size={20} aria-hidden="true" />
            : controller.guide.kind === "ios"
              ? <Share2 size={20} aria-hidden="true" />
              : controller.guide.mobile
                ? <Smartphone size={20} aria-hidden="true" />
                : <MonitorDown size={20} aria-hidden="true" />}
          <h2 id={titleId}>{label}</h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="install-shortcut-dialog__close"
          aria-label="닫기"
          title="닫기"
          onClick={controller.closeDialog}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="install-shortcut-dialog__content">
        {controller.installed ? (
          <div className="install-shortcut-dialog__installed" role="status">
            <BadgeCheck size={20} aria-hidden="true" />
            <div>
              <strong>바로가기 아이콘을 이미 사용 중이에요</strong>
              <p id={descriptionId}>브라우저가 설치됨 또는 홈 화면 실행 상태로 확인했어요.</p>
            </div>
          </div>
        ) : (
          <>
            {controller.promptState === "accepted-pending" && (
              <p className="install-shortcut-dialog__status" role="status">
                설치 요청을 보냈어요. 브라우저에서 설치를 마쳐 주세요.
              </p>
            )}
            {controller.promptState === "dismissed" && (
              <p className="install-shortcut-dialog__status" role="status">
                설치가 완료되지 않았어요. 아래 브라우저 메뉴에서 다시 확인할 수 있어요.
              </p>
            )}
            {controller.promptState === "failed" && (
              <p className="install-shortcut-dialog__status" role="alert">
                설치창을 열지 못했어요. 아래 수동 방법을 사용해 주세요.
              </p>
            )}

            {controller.nativeAvailable && (
              <div className="install-shortcut-dialog__native">
                <p id={descriptionId}>이 브라우저가 앱 설치창을 제공하고 있어요.</p>
                <button
                  type="button"
                  className="install-shortcut-dialog__install"
                  data-testid="install-shortcut-install"
                  disabled={controller.busy}
                  onClick={controller.requestNativeInstall}
                >
                  <Download size={18} aria-hidden="true" />
                  설치하기
                </button>
              </div>
            )}

            <section className="install-shortcut-dialog__guide" aria-labelledby={`${titleId}-guide`}>
              <h3 id={`${titleId}-guide`}>{controller.guide.title}</h3>
              <p id={controller.nativeAvailable ? undefined : descriptionId}>{controller.guide.intro}</p>
              <ol>
                {controller.guide.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </section>
          </>
        )}

        <aside className="install-shortcut-dialog__privacy">
          <strong>바로가기는 로그인이나 데이터 동기화가 아니에요.</strong>
          <p>설치된 앱에서 보이는 데이터는 브라우저 환경에 따라 다를 수 있어요.</p>
        </aside>

        <button
          type="button"
          className="install-shortcut-dialog__done"
          onClick={controller.closeDialog}
        >
          확인
        </button>
      </div>
    </dialog>
  )
}
