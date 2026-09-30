import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const app = resolve(repo, "app");
const { startVitest } = await import(new URL("../../app/node_modules/vitest/dist/node.js", import.meta.url));
const zone = process.env.TZ === "UTC" ? "utc" : "kst";
mkdirSync(resolve(here, "no-env"), { recursive: true });
process.env.B07_EVIDENCE_PATH = resolve(here, `evidence-${zone}.json`);

let context;
try {
  context = await startVitest("test", [resolve(here, "audit-fixture.test.tsx")], {
    config: false,
    root: repo,
    run: true,
    watch: false,
    environment: "jsdom",
    include: [resolve(here, "audit-fixture.test.tsx").replaceAll("\\", "/")],
    setupFiles: [resolve(app, "src/test/setup.ts")],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 20000,
    reporters: ["default", "json"],
    outputFile: resolve(here, `vitest-${zone}.json`),
  }, {
    configFile: false,
    envDir: resolve(here, "no-env"),
    cacheDir: resolve(here, `cache-${zone}`),
    resolve: {
      alias: {
        "@impl": resolve(repo, "impl/src"),
        "react": resolve(app, "node_modules/react"),
        "react-dom": resolve(app, "node_modules/react-dom"),
        "vitest": resolve(app, "node_modules/vitest"),
        "@testing-library/react": resolve(app, "node_modules/@testing-library/react"),
        "@testing-library/user-event": resolve(app, "node_modules/@testing-library/user-event"),
        "@testing-library/jest-dom": resolve(app, "node_modules/@testing-library/jest-dom"),
      },
    },
    esbuild: { jsx: "automatic" },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  process.exitCode ||= context.state.getUnhandledErrors().length ? 1 : 0;
} finally {
  await context?.close();
}
