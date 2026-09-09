import { execFileSync } from "node:child_process"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { accountPlanEntry, emptyAccountPlanDocument } from "./account-plan-document-schema"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import { TODAY } from "../prescription-quality-matrix.test-fixtures"
import { setActiveLocalAccount } from "./local-journal-ownership"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it("bundles existing V3-V6 validation without browser/auth/store dependencies and runs in a clean server process", async () => {
  const documents = ([3, 4, 5, 6] as const).map(version => {
    localStorage.clear()
    const document = emptyAccountPlanDocument(), entry = accountPlanEntry(accountPlanPacketFixture(version))
    document.data.plans.push(entry); document.data.currentPlanId = entry.planId
    return document
  })
  // Build in Node as well: jsdom's cross-realm Uint8Array is incompatible with esbuild.
  const script = `import { build } from 'esbuild'; import path from 'node:path';
    const output = await build({ absWorkingDir: process.cwd(), entryPoints: ['src/domain/account/account-plan-document-schema.ts'],
      alias: { '@impl': path.resolve('../impl/src') }, tsconfig: 'tsconfig.json', bundle: true, write: false,
      platform: 'neutral', format: 'esm', target: 'es2022', define: { navigator: 'undefined' }, minify: true, metafile: true });
    const m = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
    const documents = ${JSON.stringify(documents)};
    console.log(JSON.stringify({browser: typeof window, valid: documents.map(m.validateAccountPlanDocument),
      reachable: Object.keys(output.metafile.inputs),
      invalid: m.validateAccountPlanDocument({version:3,state:'ACCOUNT_STATE',kind:'PLAN',data:{arbitrary:true}})}));`
  const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module"], { input: script, encoding: "utf8" }).trim())
  expect(result.reachable.filter((name: string) => /supabase|journal-store|plan-beta-store|account-plan-service|plan-beta-flow/u.test(name))).toEqual([])
  expect(result).toMatchObject({ browser: "undefined", valid: [true, true, true, true], invalid: false })
}, 30_000)
