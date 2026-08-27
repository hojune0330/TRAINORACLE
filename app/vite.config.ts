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
    // 샌드박스/프록시 도메인 경유 접근 허용 (미리보기 공개 URL 403 방지)
    allowedHosts: true,
    fs: {
      // 디자인 토큰 CSS(colors_and_type*.css)와 impl/은 저장소 루트에 있음
      allow: [".."],
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined
          if (id.includes("react-dom") || /node_modules[\\/]react[\\/]/u.test(id)) return "vendor-react"
          if (id.includes("lucide-react")) return "vendor-icons"
          if (id.includes("zod")) return "vendor-validation"
          return undefined
        },
      },
    },
  },
})
