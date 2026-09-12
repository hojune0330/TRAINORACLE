import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  InstallShortcutMenuEntry,
  InstallShortcutProvider,
  InstallShortcutSuggestion,
} from "./InstallShortcut"

const STORAGE_KEY = "trainoracle:install-shortcut:v1"
const DAY_MS = 24 * 60 * 60 * 1000
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")

type MutableMediaQuery = MediaQueryList & {
  matches: boolean
  dispatchChange: () => void
}

function makeMediaQuery(initialMatches = false): MutableMediaQuery {
  let listener: ((event: MediaQueryListEvent) => void) | null = null
  const query = {
    matches: initialMatches,
    media: "(display-mode: standalone)",
    onchange: null,
    addEventListener: vi.fn((_type: string, next: EventListenerOrEventListenerObject) => {
      listener = typeof next === "function"
        ? next as (event: MediaQueryListEvent) => void
        : (event) => next.handleEvent(event)
    }),
    removeEventListener: vi.fn((_type: string, next: EventListenerOrEventListenerObject) => {
      const normalized = typeof next === "function"
        ? next as (event: MediaQueryListEvent) => void
        : (event: MediaQueryListEvent) => next.handleEvent(event)
      if (listener === normalized || typeof next === "function") listener = null
    }),
    addListener: vi.fn((next: (event: MediaQueryListEvent) => void) => { listener = next }),
    removeListener: vi.fn((next: (event: MediaQueryListEvent) => void) => {
      if (listener === next) listener = null
    }),
    dispatchEvent: vi.fn(() => true),
    dispatchChange() {
      listener?.({ matches: query.matches, media: query.media } as MediaQueryListEvent)
    },
  }
  return query as MutableMediaQuery
}

function setNavigator(overrides: {
  readonly userAgent?: string
  readonly platform?: string
  readonly maxTouchPoints?: number
  readonly standalone?: boolean
}) {
  for (const [key, value] of Object.entries(overrides)) {
    Object.defineProperty(navigator, key, { configurable: true, value })
  }
}

function installDialogStubs() {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: vi.fn(function showModal(this: HTMLDialogElement) { this.setAttribute("open", "") }),
  })
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: vi.fn(function close(this: HTMLDialogElement) { this.removeAttribute("open") }),
  })
}

function restoreDialogMethods() {
  if (originalShowModal === undefined) Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal")
  else Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal)
  if (originalClose === undefined) Reflect.deleteProperty(HTMLDialogElement.prototype, "close")
  else Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose)
}

function deferredInstallEvent({
  outcome = "dismissed",
  prompt = vi.fn(async () => undefined),
}: {
  readonly outcome?: "accepted" | "dismissed"
  readonly prompt?: () => Promise<void>
} = {}) {
  const event = new Event("beforeinstallprompt", { cancelable: true })
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  })
  return { event, prompt }
}

function renderManualEntry() {
  return render(
    <InstallShortcutProvider>
      <InstallShortcutMenuEntry />
    </InstallShortcutProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  const query = makeMediaQuery(false)
  vi.stubGlobal("matchMedia", vi.fn(() => query))
  setNavigator({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
    platform: "Win32",
    maxTouchPoints: 0,
    standalone: false,
  })
  installDialogStubs()
})

afterEach(() => {
  cleanup()
  restoreDialogMethods()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("InstallShortcut context boundary", () => {
  it("renders both consumers harmlessly as null outside the provider", () => {
    const { container } = render(<><InstallShortcutSuggestion eligible /><InstallShortcutMenuEntry /></>)
    expect(container).toBeEmptyDOMElement()
  })

  it("does not mount a dialog with an eligible suggestion until a user opens it", () => {
    render(
      <InstallShortcutProvider>
        <InstallShortcutSuggestion eligible />
      </InstallShortcutProvider>,
    )
    expect(screen.getByTestId("install-shortcut-suggestion")).toBeVisible()
    expect(screen.queryByTestId("install-shortcut-dialog")).not.toBeInTheDocument()
  })
})

describe("native install capability", () => {
  it("stores capability without prompting until the explicit install click", async () => {
    const user = userEvent.setup()
    const { event, prompt } = deferredInstallEvent()
    renderManualEntry()

    act(() => window.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
    expect(prompt).not.toHaveBeenCalled()

    await user.click(screen.getByTestId("install-shortcut-menu"))
    expect(prompt).not.toHaveBeenCalled()
    await user.click(screen.getByTestId("install-shortcut-install"))

    expect(prompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("install-shortcut-install")).not.toBeInTheDocument()
    expect(await screen.findByText(/설치가 완료되지 않았어요/)).toBeVisible()
  })

  it("consumes a rejecting prompt once and falls back without a success claim", async () => {
    let rejectPrompt: ((reason: Error) => void) | undefined
    const prompt = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectPrompt = reject }))
    const { event } = deferredInstallEvent({ prompt })
    const user = userEvent.setup()
    renderManualEntry()
    act(() => window.dispatchEvent(event))
    await user.click(screen.getByTestId("install-shortcut-menu"))

    const install = screen.getByTestId("install-shortcut-install")
    fireEvent.click(install)
    fireEvent.click(install)
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("install-shortcut-install")).not.toBeInTheDocument()

    act(() => rejectPrompt?.(new Error("prompt unavailable")))
    expect(await screen.findByRole("alert")).toHaveTextContent("설치창을 열지 못했어요")
    expect(screen.queryByText(/설치가 완료됐어요/)).not.toBeInTheDocument()
  })

  it("allows Escape and focus restoration while the OS prompt promise is pending", async () => {
    let resolvePrompt: (() => void) | undefined
    const prompt = vi.fn(() => new Promise<void>((resolve) => { resolvePrompt = resolve }))
    const { event } = deferredInstallEvent({ prompt })
    const user = userEvent.setup()
    renderManualEntry()
    act(() => window.dispatchEvent(event))
    const menu = screen.getByTestId("install-shortcut-menu")
    await user.click(menu)
    fireEvent.click(screen.getByTestId("install-shortcut-install"))

    expect(screen.getByRole("button", { name: "닫기" })).toBeEnabled()
    fireEvent(screen.getByTestId("install-shortcut-dialog"), new Event("cancel", { cancelable: true }))
    expect(screen.queryByTestId("install-shortcut-dialog")).not.toBeInTheDocument()
    expect(menu).toHaveFocus()

    await act(async () => {
      resolvePrompt?.()
      await Promise.resolve()
    })
    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it("does not call an accepted choice installed before browser confirmation", async () => {
    const { event } = deferredInstallEvent({ outcome: "accepted" })
    const user = userEvent.setup()
    renderManualEntry()
    act(() => window.dispatchEvent(event))
    await user.click(screen.getByTestId("install-shortcut-menu"))
    await user.click(screen.getByTestId("install-shortcut-install"))

    expect(await screen.findByText("설치 요청을 보냈어요. 브라우저에서 설치를 마쳐 주세요.")).toBeVisible()
    expect(screen.queryByText("바로가기 아이콘을 이미 사용 중이에요")).not.toBeInTheDocument()
  })
})

describe("dismissal preference", () => {
  it("suppresses a declined suggestion for seven days, then allows it again", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-12T00:00:00.000Z"))
    const { event } = deferredInstallEvent({ outcome: "dismissed" })
    const first = render(
      <InstallShortcutProvider>
        <InstallShortcutSuggestion eligible />
        <InstallShortcutMenuEntry />
      </InstallShortcutProvider>,
    )
    act(() => window.dispatchEvent(event))
    fireEvent.click(screen.getByTestId("install-shortcut-menu"))
    fireEvent.click(screen.getByTestId("install-shortcut-install"))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.queryByTestId("install-shortcut-suggestion")).not.toBeInTheDocument()
    expect(Number(window.localStorage.getItem(STORAGE_KEY))).toBe(Date.now())
    first.unmount()

    vi.setSystemTime(new Date("2026-09-18T23:59:59.000Z"))
    const beforeExpiry = render(
      <InstallShortcutProvider><InstallShortcutSuggestion eligible /></InstallShortcutProvider>,
    )
    expect(screen.queryByTestId("install-shortcut-suggestion")).not.toBeInTheDocument()
    beforeExpiry.unmount()

    vi.setSystemTime(new Date("2026-09-19T00:00:01.000Z"))
    render(<InstallShortcutProvider><InstallShortcutSuggestion eligible /></InstallShortcutProvider>)
    expect(screen.getByTestId("install-shortcut-suggestion")).toBeVisible()
  })

  it("keeps dismissal in provider memory when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
    render(
      <InstallShortcutProvider>
        <InstallShortcutSuggestion eligible />
        <InstallShortcutMenuEntry />
      </InstallShortcutProvider>,
    )

    fireEvent.click(screen.getByTestId("install-shortcut-dismiss"))
    expect(screen.queryByTestId("install-shortcut-suggestion")).not.toBeInTheDocument()
    expect(screen.getByTestId("install-shortcut-menu")).toBeVisible()
  })

  it("keeps the manual entry available after dismiss and reopens the dialog", async () => {
    const user = userEvent.setup()
    render(
      <InstallShortcutProvider>
        <InstallShortcutSuggestion eligible />
        <InstallShortcutMenuEntry />
      </InstallShortcutProvider>,
    )
    await user.click(screen.getByTestId("install-shortcut-dismiss"))
    const menu = screen.getByTestId("install-shortcut-menu")
    await user.click(menu)
    expect(screen.getByTestId("install-shortcut-dialog")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "닫기" }))
    await user.click(menu)
    expect(screen.getByTestId("install-shortcut-dialog")).toBeVisible()
  })
})

describe("installed observation and dialog accessibility", () => {
  it("hides the suggestion and native prompt after appinstalled but keeps manual status", async () => {
    const user = userEvent.setup()
    const { event } = deferredInstallEvent()
    render(
      <InstallShortcutProvider>
        <InstallShortcutSuggestion eligible />
        <InstallShortcutMenuEntry />
      </InstallShortcutProvider>,
    )
    act(() => window.dispatchEvent(event))
    act(() => window.dispatchEvent(new Event("appinstalled")))

    expect(screen.queryByTestId("install-shortcut-suggestion")).not.toBeInTheDocument()
    await user.click(screen.getByTestId("install-shortcut-menu"))
    expect(screen.queryByTestId("install-shortcut-install")).not.toBeInTheDocument()
    expect(screen.getByText("바로가기 아이콘을 이미 사용 중이에요")).toBeVisible()
  })

  it("observes standalone changes and removes its media listener on cleanup", () => {
    const query = makeMediaQuery(false)
    const matchMedia = vi.fn(() => query)
    vi.stubGlobal("matchMedia", matchMedia)
    const view = render(
      <InstallShortcutProvider><InstallShortcutSuggestion eligible /></InstallShortcutProvider>,
    )
    expect(screen.getByTestId("install-shortcut-suggestion")).toBeVisible()

    act(() => {
      query.matches = true
      query.dispatchChange()
    })
    expect(screen.queryByTestId("install-shortcut-suggestion")).not.toBeInTheDocument()
    view.unmount()

    expect(query.addEventListener).toHaveBeenCalledWith("change", expect.any(Function))
    expect(query.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function))
  })

  it("recognizes iPadOS MacIntel touch mode and shows Safari share guidance", async () => {
    setNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      platform: "MacIntel",
      maxTouchPoints: 5,
      standalone: false,
    })
    const user = userEvent.setup()
    renderManualEntry()
    expect(screen.getByTestId("install-shortcut-menu")).toHaveTextContent("홈 화면에 추가")
    await user.click(screen.getByTestId("install-shortcut-menu"))
    expect(screen.getByTestId("install-shortcut-dialog")).toHaveTextContent("Safari")
    expect(screen.getByTestId("install-shortcut-dialog")).toHaveTextContent("공유")
  })

  it("closes on Escape and restores focus to the manual entry", async () => {
    const user = userEvent.setup()
    renderManualEntry()
    const menu = screen.getByTestId("install-shortcut-menu")
    await user.click(menu)
    const dialog = screen.getByTestId("install-shortcut-dialog")
    expect(dialog).toBeVisible()

    fireEvent(dialog, new Event("cancel", { cancelable: true }))
    await waitFor(() => expect(screen.queryByTestId("install-shortcut-dialog")).not.toBeInTheDocument())
    expect(menu).toHaveFocus()
  })

  it("restores fallback focus when declining removes the suggestion opener", async () => {
    const { event } = deferredInstallEvent({ outcome: "dismissed" })
    const fallback = React.createRef<HTMLButtonElement>()
    render(
      <InstallShortcutProvider>
        <button ref={fallback} type="button">홈 더보기</button>
        <InstallShortcutSuggestion eligible returnFocusTo={() => fallback.current} />
      </InstallShortcutProvider>,
    )
    act(() => window.dispatchEvent(event))
    fireEvent.click(screen.getByRole("button", { name: "추가 방법 보기" }))
    fireEvent.click(screen.getByTestId("install-shortcut-install"))
    await waitFor(() => expect(screen.queryByTestId("install-shortcut-suggestion")).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "닫기" }))

    expect(fallback.current).toHaveFocus()
  })

  it("restores fallback focus when appinstalled removes the suggestion opener", () => {
    const fallback = React.createRef<HTMLButtonElement>()
    render(
      <InstallShortcutProvider>
        <button ref={fallback} type="button">계정 뒤로</button>
        <InstallShortcutSuggestion eligible returnFocusTo={() => fallback.current} />
      </InstallShortcutProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "추가 방법 보기" }))
    act(() => window.dispatchEvent(new Event("appinstalled")))
    expect(screen.queryByTestId("install-shortcut-suggestion")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "닫기" }))

    expect(fallback.current).toHaveFocus()
  })
})
