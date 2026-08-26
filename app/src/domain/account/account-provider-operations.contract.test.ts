import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const supabaseRoot = join(process.cwd(), "..", "supabase")
const config = readFileSync(join(supabaseRoot, "config.toml"), "utf8")
const emailTemplate = readFileSync(join(supabaseRoot, "templates", "magic-link.html"), "utf8")
const isolationRehearsal = readFileSync(
  join(supabaseRoot, "tests", "account_identity_isolation_rehearsal.sql"),
  "utf8",
)

describe("auth provider operations packet", () => {
  it("uses a six-digit, short-lived local email OTP template without a magic link", () => {
    expect(config).toContain("otp_length = 6")
    expect(config).toContain("otp_expiry = 600")
    expect(config).toContain('max_frequency = "1m"')
    expect(config).toContain("[auth.email.template.magic_link]")
    expect(emailTemplate.match(/\{\{ \.Token \}\}/gu)).toHaveLength(1)
    expect(emailTemplate).not.toContain(".ConfirmationURL")
    expect(emailTemplate).not.toMatch(/client[_-]?secret|service[_-]?role|auth[_-]?token/iu)
  })

  it("keeps local SMS signup closed until a real provider is configured", () => {
    expect(config).toMatch(/\[auth\.sms\][\s\S]*enable_signup = false/iu)
    expect(config).not.toMatch(/account_sid|auth_token|access_key|api_secret/iu)
  })

  it("locks the two-account rehearsal to synthetic users and a final rollback", () => {
    expect(isolationRehearsal).toContain("isolation-a@example.invalid")
    expect(isolationRehearsal).toContain("isolation-b@example.invalid")
    expect(isolationRehearsal).toContain("account B can read account A journal")
    expect(isolationRehearsal).toContain("account A can read account B journal")
    expect(isolationRehearsal).toContain("account B inserted as account A")
    expect(isolationRehearsal).toMatch(
      /update public\.user_private_profiles[\s\S]+when insufficient_privilege then null/iu,
    )
    expect(isolationRehearsal).toContain("under-14 online profile was not blocked")
    expect(isolationRehearsal.trimEnd()).toMatch(/verified_boundaries;$/u)
    expect(isolationRehearsal.match(/\brollback;/giu)).toHaveLength(1)
    expect(isolationRehearsal).not.toMatch(/@gmail\.com|@naver\.com|010-?\d{4}-?\d{4}/iu)
  })
})
