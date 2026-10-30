import { fileURLToPath } from "node:url"
import type { FullConfig } from "@playwright/test"
import { createServer } from "vite"

// Keep Vite in the runner process: Windows shell-tree teardown can hang even
// after all tests pass. This owns only the dedicated loopback port, never a UI server.
export default async function setup(config: FullConfig) {
  const server = await createServer({
    root: fileURLToPath(new URL("..", import.meta.url)),
    configLoader: "runner",
    // Playwright clears outputDir before a run, including the shared test-results root.
    // Keep optimizer files outside that tree so another test config cannot remove them.
    cacheDir: process.env.ACCOUNT_BROWSER_TEST_VITE_CACHE_DIR
      ?? fileURLToPath(new URL("../node_modules/.vite/account-browser-tests", import.meta.url)),
    // Scan the actual browser harnesses, not retained dist-* HTML and bundles.
    // Explicit dynamic-import entries avoid discovering harness dependencies mid-test.
    optimizeDeps: {
      entries: [
        "index.html",
        "e2e/fixtures/account-journal-draft-buffer.ts",
        "e2e/fixtures/account-journal-record-service.ts",
        "e2e/fixtures/account-plan-service.ts",
        "e2e/fixtures/account-plan-ui.tsx",
        "e2e/fixtures/account-plan-collection.ts",
        "e2e/fixtures/account-plan-collection-preparation.ts",
        "e2e/fixtures/account-plan-lock.ts",
        "e2e/fixtures/account-decoration-service.ts",
        "e2e/fixtures/account-decoration-ui.tsx",
        "e2e/fixtures/account-calendar-decoration-service.ts",
        "src/domain/account/account-oracle-v2-service.ts",
        "src/domain/account/account-oracle-v2-schema.ts",
        "src/domain/account/account-running-profile-schema.ts",
        "src/domain/account/account-running-profile-service.ts",
        "src/domain/account/account-journal-draft-buffer.ts",
      ],
    },
    // A named, memory-only fault probe. Never modify the shared working source.
    plugins: process.env.DRAFT_DELETION_MUTATION === "ignore-durable-marker" ? [{
      name: "synthetic-deletion-marker-defect", enforce: "pre",
      transform(source, id) {
        if (!id.replaceAll("\\", "/").endsWith("/src/domain/account/account-deletion-boundary.ts")) return null
        const target = "if (localStorage.getItem(ACCOUNT_DELETION_BOUNDARY_PREFIX + encodeURIComponent(userId)) !== null)"
        if (!source.includes(target)) throw new Error("Synthetic deletion marker target missing")
        return source.replace(target, "if (false)")
      },
    }] : ["omit-generation","existing-retry"].includes(process.env.DRAFT_CONSENT_MUTATION ?? "") ? [{
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
  try {
    await server.listen()
    const includesRecordService = config.projects.some((project) =>
      (Array.isArray(project.testMatch) ? project.testMatch : [project.testMatch])
        .some((match) => match === "account-journal-record-service.spec.ts"))
    if (includesRecordService) {
      // Resolve the actual static fixture graph before the per-test timeout starts.
      // warmupRequest reports transform errors; the browser tests still verify execution.
      await server.warmupRequest("/e2e/fixtures/account-journal-record-service.ts")
      await server.waitForRequestsIdle()
    }
  }
  catch (error) { await server.close(); throw error }
  return async () => { await server.close() }
}
