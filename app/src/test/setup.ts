import "@testing-library/jest-dom/vitest"

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
