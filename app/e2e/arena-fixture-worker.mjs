import { parentPort, workerData } from "node:worker_threads"
import { createArenaServer } from "../../game-server/server.mjs"

const origin = new URL(workerData)
if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1") throw Error("Loopback fixture origin required")
// Keep real server time isolated from Vite's synchronous module transforms.
const arena = createArenaServer({ origins: [origin.origin] })
arena.server.listen(0, "127.0.0.1", () => parentPort.postMessage(arena.server.address().port))
