import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0009_account_deletion_actions.sql"),
  "utf8",
)

describe("supporter shared-fields boundary", () => {
  it("projects a redacted journal DTO on the server from shared_fields", () => {
    expect(migration).toMatch(
      /create\s+(?:or\s+replace\s+)?function[\s\S]+shared_fields[\s\S]+jsonb_build_object/iu,
    )
  })
})
