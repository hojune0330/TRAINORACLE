import assert from "node:assert/strict"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import ts from "typescript"

const root = fileURLToPath(new URL("../../", import.meta.url))
function literalArrayCount(source, name) {
  let found = null
  const tree = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true)
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && node.initializer) {
      let value = node.initializer
      if (ts.isCallExpression(value) && value.expression.getText(tree) === "Object.freeze") value = value.arguments[0]
      if (ts.isNewExpression(value) && value.expression.getText(tree) === "Set") value = value.arguments[0]
      assert.ok(ts.isArrayLiteralExpression(value), `${name}: not a direct reviewed array; inspect before counting`)
      found = value.elements.length
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  assert.notEqual(found, null, `${name}: source not found`)
  return found
}
const authorityFile = "app/src/domain/detailed-prescription-runtime-authority.ts"
const rpeFile = "app/src/domain/rpe-adjusted-slot-v3.ts"
const bundleFile = "reports/review/METHOD_OWNER_REVIEW_BUNDLE_V3.json"
const authority = await readFile(resolve(root, authorityFile), "utf8")
const rpe = await readFile(resolve(root, rpeFile), "utf8")
const raw = await readFile(resolve(root, bundleFile), "utf8"), bundle = JSON.parse(raw)
assert.equal(bundle.executionAuthority, "NONE")
assert.equal(bundle.ownerDecision, "NOT_GRANTED")
const counts = Object.fromEntries(["MAIN", "BASE", "REC", "OFF"].map(role => [role, bundle.items.filter(i => i.scope.replacementRole === role).length]))
const evidence = {
  inspectedAt: new Date().toISOString(), scope: "LOCAL_SOURCE_SUPPLY_AUDIT_NOT_RUNTIME_ADOPTION",
  sources: [authorityFile, rpeFile, bundleFile],
  baselineIdentities: literalArrayCount(authority, "BASELINE_TEMPLATE_IDENTITIES"),
  ownerReviewedAdditionalAuthorities: literalArrayCount(authority, "OWNER_REVIEWED_RUNTIME_AUTHORITIES"),
  delegatedAdditionalAuthorities: literalArrayCount(authority, "DELEGATED_RUNTIME_AUTHORITIES"),
  rpeSourceBindings: literalArrayCount(rpe, "REVIEWED_RPE_SOURCE_BINDINGS_V3"),
  reviewBundle: { sha256: createHash("sha256").update(raw).digest("hex"), fingerprint: bundle.contentFingerprint,
    ownerDecision: bundle.ownerDecision, executionAuthority: bundle.executionAuthority, items: bundle.items.length,
    counts, supportAlternatives: bundle.supportAlternatives.length,
    proposals: bundle.items.map((item, index) => ({ id: item.id, parentId: item.parentId, role: item.scope.replacementRole,
      sourcePointer: `${bundleFile}#/items/${index}`, scope: item.scope, method: item.explanation.method,
      contentFingerprint: item.explanation.contentFingerprint, pending: item.explanation.pending })),
  },
  newDoseActivationPerformed: false,
  releaseBoundary: "New same-purpose method pools and numeric tuning are not publicly complete until exact configurations, transitions, explanations and placement are adopted.",
}
const out = resolve(root, "reports/implementation/evidence/workout-choice-20260928")
await mkdir(out, { recursive: true })
await writeFile(resolve(out, "supply-audit.json"), `${JSON.stringify(evidence, null, 2)}\n`)
console.log(JSON.stringify({ ...evidence, reviewBundle: { ...evidence.reviewBundle, proposals: undefined } }))
