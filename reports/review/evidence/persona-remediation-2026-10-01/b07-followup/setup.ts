import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"
vi.stubGlobal("fetch", vi.fn(() => { throw Error("NO_NETWORK_IN_B07_REVIEW") }))
Object.defineProperty(navigator, "locks", { configurable: true,
  value: { request: async (_name: string, _options: unknown, callback: (lock: object) => unknown) => callback({}) } })
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open") }
}
