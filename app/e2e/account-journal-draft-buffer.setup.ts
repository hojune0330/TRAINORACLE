import { fileURLToPath } from "node:url"
import { createServer } from "vite"

// Keep Vite in the runner process: Windows shell-tree teardown can hang even
// after all tests pass. This owns only the dedicated loopback port, never a UI server.
export default async function setup() {
  const server = await createServer({
    root: fileURLToPath(new URL("..", import.meta.url)),
    configLoader: "runner",
    cacheDir: fileURLToPath(new URL("../test-results/account-draft-buffer-vite-cache", import.meta.url)),
    // A named, memory-only fault probe. Never modify the shared working source.
    plugins: ["omit-generation","existing-retry"].includes(process.env.DRAFT_CONSENT_MUTATION ?? "") ? [{
      name: "synthetic-draft-consent-defect", enforce: "pre",
      transform(source, id) {
        if (!id.replaceAll("\\", "/").endsWith("/src/domain/account/account-journal-draft-buffer.ts")) return null
        const target=process.env.DRAFT_CONSENT_MUTATION === "existing-retry"
          ? "pinStorageOperationRevision(ownerId, operationId, 0)"
          : "record.storageConsentRevision = storageConsentRevision"
        if (!source.includes(target)) throw new Error("Synthetic consent mutation target missing")
        return source.replace(target,"/* synthetic missing generation */")
      },
    }] : [],
    server: { host: "127.0.0.1", port: 4381, strictPort: true },
    clearScreen: false,
  })
  try { await server.listen() }
  catch (error) { await server.close(); throw error }
  return async () => { await server.close() }
}
