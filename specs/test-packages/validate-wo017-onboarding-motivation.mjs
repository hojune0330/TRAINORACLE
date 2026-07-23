import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(import.meta.dirname, "../..");
const artifactPaths = {
  owner: ["reports/review/WO017_OWNER_DIRECTION.md"],
  source: ["reports/review/WO017_SOURCE_AUTHORITY_MATRIX.md"],
  order: ["CODEX_WORK_ORDER_017.md"],
  handoff: ["TRAINORACLE_SPEC_INDEX.md", "SPEC_WORK_STATUS.md", "reports/work-harness/NEXT_WORKER_HANDOFF.md"],
  fable: ["reports/review/WO017_FABLE_UX_FLOW.md"],
  terra: ["reports/review/WO017_TERRA_BINDING_MATRIX.md", "specs/test-packages/WO017_ONBOARDING_MOTIVATION_SCENARIOS.md"],
  sol: ["reports/review/WO017_SOL_ADVISORY_PREFLIGHT.md", "reports/review/WO017_IMPLEMENTATION_ACTIVATION.md"],
};

export class Wo017Error extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new Wo017Error(code, message);
}

function read(root, relativePath) {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) fail("MISSING_ARTIFACT", `missing ${relativePath}`);
  return readFileSync(path, "utf8");
}

function requireText(text, marker, code = "MISSING_REQUIRED_FIELD") {
  if (!text.includes(marker)) fail(code, `missing ${marker}`);
}

function requireFinal(text, label) {
  if (!text.trimEnd().endsWith("[DRAFT_COMPLETE]")) fail("MISSING_FINAL_MARKER", `${label} must end with [DRAFT_COMPLETE]`);
}

function reject(text, pattern, code) {
  if (pattern.test(text)) fail(code, `forbidden contract value: ${pattern}`);
}

function validateOwner(root) {
  const text = read(root, artifactPaths.owner[0]);
  reject(text, /router_mode:\s*MANDATORY/iu, "MANDATORY_ROUTER");
  reject(text, /plan_request_capture_authorized:\s*true/iu, "PLAN_REQUEST_CAPTURE");
  reject(text, /decoration_runtime_authorized:\s*true/iu, "DECORATION_RUNTIME");
  for (const marker of [
    "OWNER-017-01",
    "OWNER-017-02",
    "OWNER-017-03",
    "권장 / 권장 / 권장+b",
    "runtime_authority: false",
    "app_modification_authorized: false",
    "decoration_runtime_authorized: false",
    "plan_request_capture_authorized: false",
    "qualified_human_approval_recorded: false",
    "router_mode: OPTIONAL_ONE_CONTEXT",
    "direct_record: true",
    "skip: true",
    "router_persistence: TRANSIENT",
    "plan_interest_copy: 서비스 준비 중",
    "analysis_authority: FACTUAL_CURRENT_RECORDS_ONLY",
    "decoration_status: SEPARATE_ACCEPTANCE_REQUIRED",
  ]) requireText(text, marker);
  requireFinal(text, "owner direction");
}

function validateSource(root) {
  const text = read(root, artifactPaths.source[0]);
  for (const marker of ["CURRENT_APP_EVIDENCE", "DRAFT_REFERENCE_ONLY", "HISTORICAL_REFERENCE_ONLY", "MISSING_PHYSICAL_FILE", "CODEX_WORK_ORDER_017.md | MISSING_PHYSICAL_FILE | to-be-created during issuance"]) requireText(text, marker);
  for (let number = 10; number <= 16; number += 1) {
    const path = `CODEX_WORK_ORDER_${String(number).padStart(3, "0")}.md | MISSING_PHYSICAL_FILE | stage ID only`;
    requireText(text, path, "PHANTOM_WORK_ORDER");
  }
  reject(text, /CODEX_WORK_ORDER_01[0-6]\.md\s*\|\s*(?:CURRENT_APP_EVIDENCE|DRAFT_REFERENCE_ONLY|HISTORICAL_REFERENCE_ONLY)/iu, "PHANTOM_WORK_ORDER");
  requireFinal(text, "source matrix");
}

function validateOrder(root) {
  const text = read(root, artifactPaths.order[0]);
  reject(text, /plan_request_capture_authorized:\s*true/iu, "PLAN_REQUEST_CAPTURE");
  reject(text, /(?:fabricated_threshold|implementation_authorized):\s*true/iu, "FALSE_ANALYSIS");
  if (!text.includes("both_pain_and_mood: pain_timeline; mood_saved_confirmation")) fail("MOOD_PLUS_PAIN_PRECEDENCE", "pain must precede mood while confirming mood was saved");
  for (const marker of [
    "status: ISSUED_DOCUMENTATION_ONLY",
    "runtime_authority: false",
    "app_modification_authorized: false",
    "next_actor: FABLE",
    "Task A: FABLE",
    "reports/review/WO017_FABLE_UX_FLOW.md",
    "Task B: TERRA_VERY_HIGH",
    "reports/review/WO017_TERRA_BINDING_MATRIX.md",
    "specs/test-packages/WO017_ONBOARDING_MOTIVATION_SCENARIOS.md",
    "Task C: SOL_HIGH",
    "reports/review/WO017_SOL_ADVISORY_PREFLIGHT.md",
    "reports/review/WO017_IMPLEMENTATION_ACTIVATION.md",
    "Task D: OWNER_ONLY",
    "implementation_activation: PENDING_OWNER",
    "router_mode: OPTIONAL_ONE_CONTEXT",
    "plan_interest_copy: 서비스 준비 중",
    "plan_route_actions: [journal, back, skip]",
    "plan_request_capture_authorized: false",
    "receipt_precedence: evening_pain > evening_mood > post_session_distance > generic_local_save",
    "both_pain_and_mood: pain_timeline; mood_saved_confirmation",
    "fabricated_threshold: false",
    "[WO017] Issue onboarding motivation planning track",
    "[WO017] Add Fable onboarding UX flow",
    "[WO017] Bind onboarding UX to current contracts",
    "[WO017] Record Sol pre-implementation advisory",
  ]) requireText(text, marker);
  requireFinal(text, "work order");
}

function validateHandoff(root) {
  for (const relativePath of artifactPaths.handoff) {
    const text = read(root, relativePath);
    reject(text, /\bIMPLEMENTATION_AUTHORIZED\b/iu, "IMPLEMENTATION_ACTIVATED");
    for (const marker of ["WO017", "ISSUED_DOCUMENTATION_ONLY", "IMPLEMENTATION_NOT_AUTHORIZED", "Fable -> Terra Very High -> Sol High -> Owner"]) requireText(text, marker);
    reject(text, /implementation_activation:\s*(?:ACTIVE|AUTHORIZED|TRUE)/iu, "IMPLEMENTATION_ACTIVATED");
  }
}

function validateFable(root) {
  const text = read(root, artifactPaths.fable[0]);
  for (const marker of [
    "source_model: FABLE",
    "source_session_label:",
    "source_timestamp_utc:",
    "issuance_sha:",
    "source_url: NOT_PUBLISHED_PRIVATE_SESSION",
    "flow_viewport: 375x667",
    "router_mode: OPTIONAL_ONE_CONTEXT",
    "direct_record: true",
    "skip: true",
    "back: true",
    "returning_user_rule: EXISTING_LOCAL_ENTRY_ONLY",
    "receipt_precedence: evening_pain > evening_mood > post_session_distance > generic_local_save",
    "personas: 4",
    "reduced_motion: supported",
    "decoration_status: PROPOSAL_ONLY",
    "implementation_authorized: false",
    "streak_pressure: false",
    "controlling_issue_url: https://github.com/hojune0330/TRAINORACLE/issues/",
    "pr_title: [WO017] Add Fable onboarding UX flow",
  ]) requireText(text, marker);
  reject(text, /source_url:\s*https?:\/\/(?!github\.com\/hojune0330\/TRAINORACLE\/issues\/)/iu, "UNSAFE_FABLE_PROVENANCE");
  reject(text, /streak_pressure:\s*true/iu, "STREAK_PRESSURE");
  reject(text, /implementation_authorized:\s*true/iu, "IMPLEMENTATION_ACTIVATED");
  if (!text.includes("pr_url: https://github.com/hojune0330/TRAINORACLE/pull/")) fail("MISSING_WO017_PR_LINK", "Fable PR link missing");
  requireFinal(text, "Fable artifact");
}

function validateTerra(root) {
  const matrix = read(root, artifactPaths.terra[0]);
  const scenarios = read(root, artifactPaths.terra[1]);
  for (const marker of ["primary_worker: gpt-5.6-terra", "reasoning_effort: xhigh", "implementation_authorized: false", "CURRENT_APP_EVIDENCE", "DRAFT_REFERENCE_ONLY", "insufficient_state:", "controlling_issue_url: https://github.com/hojune0330/TRAINORACLE/issues/", "pr_title: [WO017] Bind onboarding UX to current contracts", "pr_url: https://github.com/hojune0330/TRAINORACLE/pull/"]) requireText(matrix, marker);
  for (const marker of ["implementation_authorized: false", "SCENARIO-PAIN-MOOD", "SCENARIO-PLAN-STUB", "SCENARIO-INSUFFICIENT-FACTS"]) requireText(scenarios, marker);
  reject(`${matrix}\n${scenarios}`, /(?:factual_analysis|readiness|threshold):\s*(?:fabricated|true|invented)/iu, "FALSE_ANALYSIS");
  reject(`${matrix}\n${scenarios}`, /implementation_authorized:\s*true/iu, "IMPLEMENTATION_ACTIVATED");
  requireFinal(matrix, "Terra matrix");
  requireFinal(scenarios, "Terra scenarios");
}

function validateSol(root) {
  const report = read(root, artifactPaths.sol[0]);
  const activation = read(root, artifactPaths.sol[1]);
  for (const marker of ["model: gpt-5.6-sol", "reasoning_effort: high", "non_authoritative: true", "reviewed_terra_sha:", "coercive_retention", "youth_injury_pressure", "privacy_storage_expansion", "false_plan_analysis_claims", "accessibility", "ai_as_human_authority", "decoration_activation", "verdict:"]) requireText(report, marker);
  for (const marker of ["issuance_sha:", "fable_sha:", "terra_sha:", "sol_head_sha: RECORDED_AFTER_COMMIT_IN_GITHUB_RECEIPT", "owner_approval_signature: NOT_RECORDED", "next_actor: OWNER"]) requireText(activation, marker);
  if (!activation.includes("implementation_activation: PENDING_OWNER")) fail("IMPLEMENTATION_ACTIVATED", "activation packet must remain pending owner");
  reject(`${report}\n${activation}`, /(?:qualified_human_approval|owner_approval|implementation_activation):\s*(?:true|APPROVED|ACTIVE)/iu, "AI_AS_HUMAN_APPROVAL");
  requireFinal(report, "Sol report");
  requireFinal(activation, "activation packet");
}

const validators = { owner: validateOwner, source: validateSource, order: validateOrder, handoff: validateHandoff, fable: validateFable, terra: validateTerra, sol: validateSol };
const phaseArtifacts = { issuance: ["owner", "source", "order", "handoff"], fable: ["owner", "source", "order", "handoff", "fable"], terra: ["owner", "source", "order", "handoff", "fable", "terra"], sol: ["owner", "source", "order", "handoff", "fable", "terra", "sol"] };

export function validateArtifact(root, artifact) {
  const validator = validators[artifact];
  if (!validator) fail("USAGE", `unknown artifact: ${artifact}`);
  validator(root);
}

export function validatePhase(root, phase) {
  const artifacts = phaseArtifacts[phase];
  if (!artifacts) fail("USAGE", `unknown phase: ${phase}`);
  for (const artifact of artifacts) validateArtifact(root, artifact);
}

const allowedPathPatterns = [
  /^\.gitignore$/u,
  /^\.omo\/(?:boulder\.json|start-work\/ledger\.jsonl|plans\/trainoracle-onboarding-motivation-loop\.md|drafts\/trainoracle-onboarding-motivation-loop\.md|drafts\/wo017-terra-xhigh-worker-prompt\.md)$/u,
  /^CODEX_WORK_ORDER_017\.md$/u,
  /^reports\/review\/WO017_[A-Z_]+\.md$/u,
  /^reports\/work-harness\/NEXT_WORKER_HANDOFF\.md$/u,
  /^(?:TRAINORACLE_SPEC_INDEX|SPEC_WORK_STATUS)\.md$/u,
  /^specs\/test-packages\/(?:validate-wo017-onboarding-motivation(?:\.test)?\.mjs|WO017_ONBOARDING_MOTIVATION_SCENARIOS\.md)$/u,
  /^specs\/test-packages\/fixtures\/wo017\//u,
];

export function validateChangedPaths(paths) {
  for (const relativePath of paths.filter(Boolean)) {
    if (/^(?:app|impl)\//u.test(relativePath)) fail("APP_PATH_CHANGE", `forbidden app/impl path: ${relativePath}`);
    if (["reports/work-harness/TRAINORACLE_WORK_CATALOG.json", "HANDOFF_NEXT_CHAT.md"].includes(relativePath)) fail("PROTECTED_PATH_CHANGE", `protected path: ${relativePath}`);
    if (!allowedPathPatterns.some((pattern) => pattern.test(relativePath))) fail("CHANGED_PATH_NOT_ALLOWED", `outside WO017 allowlist: ${relativePath}`);
  }
}

function changedPaths() {
  const tracked = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { cwd: repoRoot, encoding: "utf8" }).split(/\r?\n/u);
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: repoRoot, encoding: "utf8" }).split(/\r?\n/u);
  return [...new Set([...tracked, ...untracked].filter(Boolean))];
}

function parseCli(args) {
  const state = { root: repoRoot, artifact: null, artifactPaths: [], phase: null, checkWorktree: false, pathsFile: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--artifact") state.artifact = args[++index];
    else if (arg === "--phase") state.phase = args[++index];
    else if (arg === "--root") state.root = resolve(args[++index]);
    else if (arg === "--check-worktree") state.checkWorktree = true;
    else if (arg === "--paths-file") state.pathsFile = resolve(args[++index]);
    else if (optionsArtifactPath(state, arg)) state.artifactPaths.push(arg);
    else fail("USAGE", `unknown argument: ${arg}`);
  }
  return state;
}

function optionsArtifactPath(state, value) {
  return Boolean(state.artifact) && !value.startsWith("--");
}

function main() {
  const options = parseCli(process.argv.slice(2));
  if (options.checkWorktree) {
    const paths = options.pathsFile ? readFileSync(options.pathsFile, "utf8").split(/\r?\n/u).filter(Boolean) : changedPaths();
    validateChangedPaths(paths);
    console.log("PASS WO017 changed-path allowlist");
    return;
  }
  if (options.artifact) {
    const expected = artifactPaths[options.artifact] ?? [];
    if (options.artifactPaths.length > 0 && (options.artifactPaths.length !== expected.length || options.artifactPaths.some((path, index) => path !== expected[index]))) {
      fail("USAGE", `artifact paths must match ${expected.join(", ")}`);
    }
    validateArtifact(options.root, options.artifact);
    console.log(`PASS WO017 artifact=${options.artifact}`);
    return;
  }
  if (options.phase) {
    validatePhase(options.root, options.phase);
    console.log(`PASS WO017 phase=${options.phase}`);
    return;
  }
  fail("USAGE", "use --artifact, --phase, or --check-worktree");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    if (error instanceof Wo017Error) {
      console.error(`FAIL WO017 ${error.code}`);
      process.exitCode = 1;
    } else throw error;
  }
}
