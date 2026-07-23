import type { D1Migration } from "cloudflare:test"

declare global {
  namespace Cloudflare {
    interface Env {
      readonly DB: D1Database
      readonly TEST_MIGRATIONS: readonly D1Migration[]
    }
  }
}

export {}
