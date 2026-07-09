import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"

// ADR A3: frontend imports impl/ directly — no dual implementation.
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@impl": fileURLToPath(new URL("../impl/src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    fs: {
      // 디자인 토큰 CSS(colors_and_type*.css)와 impl/은 저장소 루트에 있음
      allow: [".."],
    },
  },
})
