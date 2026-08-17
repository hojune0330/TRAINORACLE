import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import test from "node:test"
import {
  EXPECTED_POLICY,
  evaluateTrainingEligibility,
  validateExistingProcessingGuards,
  validatePersonalizedPrescriptionPolicy,
} from "./validate-personalized-prescription-policy.mjs"

const root = resolve(import.meta.dirname, "../..")
const read = (path) => readFileSync(resolve(root, path), "utf8")
const validator = resolve(import.meta.dirname, "validate-personalized-prescription-policy.mjs")
const policyStart = "<!-- MACHINE_POLICY:PERSONALIZED_PRESCRIPTION_V1:START -->"
const policyEnd = "<!-- MACHINE_POLICY:PERSONALIZED_PRESCRIPTION_V1:END -->"

function runValidator(...args) {
  return spawnSync(process.execPath, [validator, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
}

function replacePolicy(document, policy) {
  const start = document.indexOf(policyStart)
  const end = document.indexOf(policyEnd)
  assert.notEqual(start, -1, "mutation target policy start must exist")
  assert.ok(end > start, "mutation target policy end must exist")
  const replacement = `${policyStart}\n\`\`\`json\n${JSON.stringify(policy, null, 2)}\n\`\`\`\n`
  return `${document.slice(0, start)}${replacement}${document.slice(end)}`
}

function leafPaths(value, prefix = []) {
  return Object.entries(value).flatMap(([key, child]) => (
    child !== null && typeof child === "object" && !Array.isArray(child)
      ? leafPaths(child, [...prefix, key])
      : [[...prefix, key]]
  ))
}

function removeLeaf(value, path) {
  const clone = structuredClone(value)
  let target = clone
  for (const segment of path.slice(0, -1)) {
    assert.ok(Object.hasOwn(target, segment), `mutation target ${path.join(".")} must exist`)
    target = target[segment]
  }
  const key = path.at(-1)
  assert.ok(Object.hasOwn(target, key), `mutation target ${path.join(".")} must exist`)
  delete target[key]
  return clone
}

test("characterizes the existing guardian privacy and legal processing guards", () => {
  const summary = validateExistingProcessingGuards({
    templateLibrary: read("specs/active/TEMPLATE_LIBRARY_SPEC.md"),
    planGenerator: read("specs/active/PLAN_GENERATOR_SPEC.md"),
    appBridge: read("specs/active/APP_IMPLEMENTATION_BRIDGE.md"),
  })

  assert.deepEqual(summary, { guardianSensitiveProcessingGuard: true })
})

test("accepts the approved age-neutral policy split and scoped selection authority", () => {
  const decisionPath = resolve(
    root,
    "reports/review/PERSONALIZED_AUTO_PRESCRIPTION_YOUTH_TRAINING_DECISION_2026-08-17.md",
  )

  assert.doesNotThrow(() => validatePersonalizedPrescriptionPolicy({
    templateLibrary: read("specs/active/TEMPLATE_LIBRARY_SPEC.md"),
    planGenerator: read("specs/active/PLAN_GENERATOR_SPEC.md"),
    appBridge: read("specs/active/APP_IMPLEMENTATION_BRIDGE.md"),
    decisionReport: existsSync(decisionPath) ? readFileSync(decisionPath, "utf8") : "",
  }))
})

test("gives youth and adult athletes identical eligibility and dose with identical allowed gates", () => {
  const common = {
    readiness: "PASS",
    sourceTemplateScope: "PASS",
    currentRecord: "PASS",
    recentLoad: "PASS",
    d9: "PASS",
    recovery: "PASS",
  }
  const youth = evaluateTrainingEligibility(EXPECTED_POLICY, {
    ...common,
    isMinor: true,
    schoolDivision: "MIDDLE_SCHOOL",
  })
  const adult = evaluateTrainingEligibility(EXPECTED_POLICY, {
    ...common,
    isMinor: false,
    schoolDivision: "OPEN",
  })

  assert.deepEqual(youth, adult)
  assert.deepEqual(youth, { eligible: true, doseAdjustment: "UNCHANGED" })
})

test("rejects removal of every machine policy field through the validator process", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "trainoracle-policy-mutation-"))
  const documents = [
    ["--template", read("specs/active/TEMPLATE_LIBRARY_SPEC.md"), "template.md"],
    ["--plan", read("specs/active/PLAN_GENERATOR_SPEC.md"), "plan.md"],
  ]

  try {
    for (const [flag, document, filename] of documents) {
      for (const path of leafPaths(EXPECTED_POLICY)) {
        const mutatedPolicy = removeLeaf(EXPECTED_POLICY, path)
        const mutatedDocument = replacePolicy(document, mutatedPolicy)
        assert.notEqual(mutatedDocument, document, `mutation ${path.join(".")} must change input`)
        const mutationPath = resolve(directory, filename)
        writeFileSync(mutationPath, mutatedDocument, "utf8")
        const result = runValidator(flag, mutationPath)
        assert.equal(result.status, 1, `${flag} ${path.join(".")} unexpectedly passed`)
        assert.match(result.stderr, /machine policy does not match the approved policy/u)
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("rejects removal of the existing guardian processing guard through the validator process", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "trainoracle-guardian-mutation-"))
  const bridge = read("specs/active/APP_IMPLEMENTATION_BRIDGE.md")
  const target = "minor_requires_guardian_consent_for_sensitive_processing: true"
  assert.ok(bridge.includes(target), "guardian mutation target must exist")
  const mutated = bridge.replace(target, "")
  assert.notEqual(mutated, bridge)
  const mutationPath = resolve(directory, "bridge.md")
  writeFileSync(mutationPath, mutated, "utf8")

  try {
    const result = runValidator("--bridge", mutationPath)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /existing processing guard missing/u)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("keeps the historical V2-SEED-05 packet byte-bound activation gate green", () => {
  const historicalValidator = resolve(
    import.meta.dirname,
    "validate-v2-seed-05-activation-packet.mjs",
  )
  const result = spawnSync(process.execPath, [historicalValidator], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /runtime activation FORBIDDEN/u)
})
