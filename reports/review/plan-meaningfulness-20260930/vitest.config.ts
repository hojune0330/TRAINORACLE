import { fileURLToPath } from "node:url"
import baseConfig from "../../../app/vitest.config.ts"

export default {
  ...baseConfig,
  root: fileURLToPath(new URL("../../../app", import.meta.url)),
  test: {
    ...baseConfig.test,
    include: ["../reports/review/plan-meaningfulness-20260930/**/*.test.ts"],
  },
}
