import { vi } from "vitest"

const forbidden = () => { throw new Error("Independent review forbids network access") }
vi.stubGlobal("fetch", forbidden)
vi.stubGlobal("WebSocket", forbidden)
XMLHttpRequest.prototype.open = forbidden
