import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const templates = ["confirm-signup.html", "magic-link.html"].map(name => ({
  name,
  source: readFileSync(join(process.cwd(), "..", "supabase", "templates", name), "utf8"),
}))

describe("hosted PKCE email templates", () => {
  it.each(templates)("sends $name to the app token-hash callback", ({ source }) => {
    expect(source).toContain("{{ .RedirectTo }}")
    expect(source).toContain("#token_hash={{ .TokenHash }}")
    expect(source).toContain("type=email")
    expect(source).not.toContain("{{ .ConfirmationURL }}")
  })
})
