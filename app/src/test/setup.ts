import "@testing-library/jest-dom/vitest"

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
