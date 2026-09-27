import { mergeConfig } from "../../../../../app/node_modules/vite/dist/node/index.js";
import baseConfig from "../../../../../app/vite.config.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const evidenceDir = dirname(fileURLToPath(import.meta.url));

export default mergeConfig(baseConfig, {
  cacheDir: resolve(evidenceDir, "vite-cache"),
  server: {
    host: "127.0.0.1",
    port: 4209,
    strictPort: true,
    allowedHosts: ["127.0.0.1"],
    hmr: { host: "127.0.0.1", clientPort: 4209 },
  },
});
