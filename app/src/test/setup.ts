import "@testing-library/jest-dom/vitest"

// jsdom does not implement native dialog behavior; browser tests cover focus and modality.
if (typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }
}
if (typeof HTMLDialogElement.prototype.close !== "function") {
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open")
    this.dispatchEvent(new Event("close"))
  }
}

/* jsdom에는 Pointer Capture API가 없어 @use-gesture가 pointerdown에서 죽는다. no-op 폴리필. */
if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
  Element.prototype.hasPointerCapture = () => false
}

Object.defineProperty(navigator, "locks", {
  configurable: true,
  value: {
    request: async (
      _name: string,
      _options: unknown,
      callback: (lock: object | null) => unknown,
    ) => callback({}),
  },
})
