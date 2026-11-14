import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const template = (name: string) => readFileSync(join(process.cwd(), "..", "supabase", "templates", name), "utf8")

describe("password email callback contracts", () => {
  it("confirms signup at the provider before its PKCE code returns to the app", () => {
    const source = template("confirm-password-signup.html")
    const links = [...source.matchAll(/href="([^"]+)"/g)].map(match => match[1])
    expect(links).toEqual(["{{ .ConfirmationURL }}"])
    expect(source).not.toContain("{{ .RedirectTo }}")
    expect(source).not.toContain("{{ .TokenHash }}")
    expect(source).not.toContain("type=recovery")
  })

  it("keeps password recovery on the isolated recovery token-hash callback", () => {
    const source = template("password-recovery.html")
    expect(source).toContain('href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=recovery"')
    expect(source).not.toContain("{{ .ConfirmationURL }}")
  })
})
