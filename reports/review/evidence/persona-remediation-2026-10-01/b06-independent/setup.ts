import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// This isolated jsdom fixture never connects to a provider or a local server.
vi.stubGlobal("fetch", vi.fn(() => { throw new Error("NO_NETWORK_IN_B06_REVIEW") }))
Object.defineProperty(navigator, "locks", {
  configurable: true,
  value: { request: async (_name: string, _options: unknown, callback: (lock: object) => unknown) => callback({}) },
})
