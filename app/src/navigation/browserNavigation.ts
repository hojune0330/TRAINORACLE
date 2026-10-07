/** Native-history coordination only. No record, draft, account or purchase data belongs here. */
export const BROWSER_BACK_LAYER_HISTORY_KEY = "trainoracleBackLayer"

type BackLayerOptions = {
  readonly id: string
  readonly canClose: () => boolean
  readonly onClose: () => void
}

type BackLayer = {
  readonly id: string
  ownsEntry: boolean
  active: boolean
  pendingBack: boolean
  waitingForParentBack: boolean
  revision: number
  options: BackLayerOptions | null
}

let navigationEpoch = 0
let restoringPopScroll = false
let restorationFrame: number | undefined
let observedLayer: string | null = null
let recoveringLayer: BackLayer | null = null
let pendingBackLayerId: string | null = null
const layers = new Map<string, BackLayer>()
const popListeners = new Set<() => void>()
const consumedPopEvents = new WeakSet<PopStateEvent>()
let captureInstalled = false

function layerMarker(state: unknown): string | null {
  if (state === null || typeof state !== "object") return null
  const marker = (state as Record<string, unknown>)[BROWSER_BACK_LAYER_HISTORY_KEY]
  return typeof marker === "string" ? marker : null
}

export function getBrowserNavigationEpoch(): number { return navigationEpoch }

/** Called by the shell before it handles a native Back/Forward event. */
export function beginBrowserPopNavigation(): number {
  navigationEpoch += 1
  restoringPopScroll = true
  for (const listener of popListeners) listener()
  if (restorationFrame !== undefined) window.cancelAnimationFrame(restorationFrame)
  restorationFrame = window.requestAnimationFrame(() => {
    restoringPopScroll = false
    restorationFrame = undefined
  })
  return navigationEpoch
}

export function isBrowserPopScrollRestoration(): boolean { return restoringPopScroll }

export function subscribeBrowserPopNavigation(listener: () => void): () => void {
  popListeners.add(listener)
  return () => { popListeners.delete(listener) }
}

/** Other native-history readers must not also act on a top layer's POP. */
export function isBrowserPopNavigationConsumed(event: PopStateEvent): boolean {
  return consumedPopEvents.has(event)
}

export function hasActiveBrowserBackLayer(): boolean {
  return [...layers.values()].some(layer => layer.active)
}

function mayClose(layer: BackLayer): boolean {
  try { return layer.options?.canClose() === true }
  catch { return false }
}

function closeLayer(layer: BackLayer): void {
  if (!layer.active) return
  const close = layer.options?.onClose
  // Consume before callbacks: duplicate Back/Escape cannot run an action twice.
  layer.active = false
  layer.pendingBack = false
  layer.options = null
  close?.()
}

function pushLayerEntry(layer: BackLayer): void {
  layer.waitingForParentBack = false
  try {
    window.history.pushState({ ...window.history.state, [BROWSER_BACK_LAYER_HISTORY_KEY]: layer.id }, "", window.location.href)
    layer.ownsEntry = true
    navigationEpoch += 1
  } catch {
    layer.ownsEntry = false
    // A denied history write must not trap a normal browser/site Back.
  }
  observedLayer = layerMarker(window.history.state)
}

/** Closing by button and Back consumes the same opaque entry, never its parent. */
export function registerBrowserBackLayer(options: BackLayerOptions): {
  readonly close: () => void
  readonly dispose: () => void
} {
  if (!captureInstalled) {
    // Capture precedes both the shell and independently mounted editor readers.
    window.addEventListener("popstate", consumeBrowserBackLayer, true)
    captureInstalled = true
  }
  const currentMarker = layerMarker(window.history.state)
  let layer = layers.get(options.id)
  if (layer === undefined) {
    layer = { id: options.id, ownsEntry: false, active: false, pendingBack: false, waitingForParentBack: false, revision: 0, options: null }
    layers.set(options.id, layer)
  }
  const registered = layer
  registered.active = true
  registered.options = options
  registered.revision += 1
  if (pendingBackLayerId !== null) {
    // A previously closed layer's native Back is asynchronous. Wait for its
    // departure before putting a new (even same-id) layer above the parent.
    registered.waitingForParentBack = true
    registered.ownsEntry = false
    registered.pendingBack = false
    navigationEpoch += 1
  } else if (currentMarker !== registered.id) pushLayerEntry(registered)
  observedLayer = layerMarker(window.history.state)

  return {
    close: () => {
      if (!registered.active || registered.pendingBack || !mayClose(registered)) return
      if (registered.ownsEntry && layerMarker(window.history.state) === registered.id) {
        pendingBackLayerId = registered.id
        closeLayer(registered)
        registered.pendingBack = true
        window.history.back()
      } else closeLayer(registered)
    },
    dispose: () => {
      registered.active = false
      registered.options = null
      const revision = ++registered.revision
      // StrictMode replays effect cleanup/setup synchronously. Do not consume
      // its entry if the same mounted layer has already registered again.
      queueMicrotask(() => {
        if (registered.active || registered.revision !== revision || registered.pendingBack) return
        if (registered.ownsEntry && layerMarker(window.history.state) === registered.id) {
          registered.pendingBack = true
          pendingBackLayerId = registered.id
          window.history.back()
        }
      })
    },
  }
}

/** True means this POP belongs to a layer, not to the parent screen. */
export function consumeBrowserBackLayer(event: PopStateEvent): boolean {
  if (isBrowserPopNavigationConsumed(event)) return true
  const consume = () => { consumedPopEvents.add(event); return true }
  const nextMarker = layerMarker(event.state)
  const previousMarker = observedLayer
  const departed = previousMarker === null ? undefined : layers.get(previousMarker)
  observedLayer = nextMarker

  if (pendingBackLayerId !== null && previousMarker === pendingBackLayerId && nextMarker !== pendingBackLayerId) {
    consume()
    const pending = layers.get(pendingBackLayerId)
    if (pending !== undefined) pending.pendingBack = false
    pendingBackLayerId = null
    for (const layer of layers.values()) {
      if (layer.active && layer.waitingForParentBack) pushLayerEntry(layer)
    }
    return true
  }

  if (recoveringLayer !== null && recoveringLayer.active) {
    if (nextMarker === recoveringLayer.id) {
      recoveringLayer.pendingBack = false
      recoveringLayer = null
    } else window.history.forward()
    return consume()
  }
  recoveringLayer = null

  if (departed?.ownsEntry && departed.id !== nextMarker) {
    consume()
    departed.pendingBack = false
    if (departed.active) {
      if (!mayClose(departed)) {
        departed.pendingBack = false
        recoveringLayer = departed
        // The entry still exists. Restore it, without pushing duplicate history.
        window.history.forward()
      } else closeLayer(departed)
    }
    return consume()
  }
  // Forward into a completed layer is not an instruction to reopen, delete,
  // save input, or repeat a purchase.
  if (nextMarker !== null) {
    const next = layers.get(nextMarker)
    if (next?.ownsEntry && !next.active) return consume()
  }
  return false
}
