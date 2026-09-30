import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const require = createRequire(path.join(root, 'app/package.json'));
const { build } = require('esbuild');
const { JSDOM } = require('jsdom');
const outputName = process.argv[2] ?? 'baseline-kst-v1.json';
const mutation = process.argv[3] ?? 'none';
assert.ok(['none', 'drop-prior-archives', 'drop-prior-replan-archives'].includes(mutation));
assert.match(outputName, /^[a-z0-9-]+\.json$/);
const output = path.join(here, outputName);
assert.equal(existsSync(output), false, 'Evidence must not be overwritten');
const trackedRoots = ['app/src', 'impl/src', 'supabase', 'specs'];
function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const name = path.join(dir, e.name);
    return e.isDirectory() ? filesIn(name) : [name];
  });
}
function sourceFingerprint() {
  const hash = createHash('sha256');
  for (const file of trackedRoots.flatMap(p => filesIn(path.join(root, p))).sort()) {
    hash.update(path.relative(root, file));
    hash.update(readFileSync(file));
  }
  return hash.digest('hex');
}
const beforeHash = sourceFingerprint();
let mutationApplications = 0;
const exports = [
  'export { replanFixture } from "./src/domain/execution-replan.test-fixture";',
  'export { prepareCatalogReplacement, catalogProtectedSlots } from "./src/domain/catalog-replacement";',
  'export { applyCatalogReplacement } from "./src/domain/catalog-replacement-store";',
  'export { prepareExecutionReplan, replanFingerprint } from "./src/domain/execution-replan";',
  'export { applyExecutionReplan } from "./src/domain/execution-replan-store";',
  'export { readJournalOriginalPlan } from "./src/domain/journal-original-plan";',
  'export { reviewPlanExecution } from "./src/domain/plan-execution-review";',
  'export { createPlannedSessionLogDraft } from "./src/domain/planned-session-link";',
  'export { loadVersionedPlanBetaState, readArchivedOriginalPlans, archiveAndClearActivePlanWithLock, loadPreviousContinuity, savePlanBetaState } from "./src/domain/plan-beta-store";',
  'export { planBetaStateV3Schema, planHistoryListSchema } from "./src/domain/plan-beta-schema";',
  'export { createInitialPeriodizationContext } from "./src/domain/periodization-lineage";',
  'export { generatePlanFromDraft, selectPlanForActivation } from "./src/domain/plan-beta-flow";',
  'export { savePlanAdaptationContext, evaluateActivePlanAdaptationSafety, prepareNextFrameAdaptation, acceptPreparedNextFrameAdaptation } from "./src/domain/plan-adaptation-ui";',
  'export { activateAcceptedNextFrameSuccessor } from "./src/domain/plan-successor-activation";',
  'export { ALL_WORKOUT_CATALOG } from "../impl/src/prescription/all-workout-calculator";',
  'export { generatePlanCandidates } from "../impl/src/plan-generator/generator";',
  'export { baseRequest, expectGenerated } from "../impl/test/fixtures/plan-beta-request";',
].join('\n');
const built = await build({ stdin: { contents: exports, resolveDir: path.join(root, 'app'), loader: 'ts' },
  tsconfig: path.join(root, 'app/tsconfig.json'), bundle: true, write: false, platform: 'neutral',
  format: 'esm', target: 'es2022', define: { 'import.meta.env': '{}' }, logLevel: 'silent',
  plugins: [{ name: 'forbid-excluded-network-client', setup(api) {
    api.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'excluded-network-client', namespace: 'synthetic' }));
    api.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents:
      'export function createClient() { throw new Error("Excluded Supabase client invoked"); }', loader: 'js' }));
  } }, { name: 'memory-only-regression', setup(api) {
    if (mutation === 'none') return;
    const filter = mutation === 'drop-prior-archives' ? /[\\/]catalog-replacement-store\.ts$/ : /[\\/]execution-replan-store\.ts$/;
    api.onLoad({ filter }, ({ path: file }) => {
      const original = readFileSync(file, 'utf8');
      const needle = 'JSON.stringify(retained ? history.data : [archived, ...history.data])';
      assert.equal(original.split(needle).length, 2, 'Mutation anchor must match exactly once');
      mutationApplications++;
      return { contents: original.replace(needle, 'JSON.stringify(retained ? history.data : [archived])'), loader: 'ts' };
    });
  } }] });
const dom = new JSDOM('', { url: 'https://synthetic.invalid' });
for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'Event', 'Storage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
Object.defineProperty(navigator, 'locks', { configurable: true, value: {
  request: async (_name, _options, callback) => callback({ synthetic: true }),
} });
const RealDate = Date;
let networkAttempts = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { networkAttempts++; throw new Error('External network is excluded'); };
let now = '2026-09-29T03:00:00.000Z';
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return new RealDate(now).getTime(); }
};
const V = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const ACTIVE = 'trainoracle.plan-beta.v1';
const HISTORY = 'trainoracle.plan-beta.history.v1';
const JOURNAL = 'trainoracle.journal.v1';
const CONTEXT = 'trainoracle.plan-adaptation-context.v1';
const PENDING = 'trainoracle.plan-beta.adaptation.v1';
const results = [];
let observations = {};
function note(key, value) { observations[key] = value; }
function reset() { localStorage.clear(); sessionStorage.clear(); now = '2026-09-29T03:00:00.000Z'; }
function current() {
  const value = V.loadVersionedPlanBetaState();
  assert.ok(value && value.version === 3, 'Public current-plan reader must resolve V3');
  return value;
}
function entries() { return JSON.parse(localStorage.getItem(JOURNAL) ?? '[]'); }
function writeEntries(value) { localStorage.setItem(JOURNAL, JSON.stringify(value)); }
function rawSnapshot() { return Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => {
  const key = localStorage.key(i); return [key, localStorage.getItem(key)];
}).sort(([a], [b]) => a.localeCompare(b))); }
function seed() {
  const f = V.replanFixture();
  f.state.periodization = V.createInitialPeriodizationContext(f.state.activePlan.candidateId, f.state.generatedAt);
  f.entries = f.entries.map(e => ({ ...e, title: 'SYNTHETIC ONLY', memo: '' }));
  assert.equal(V.planBetaStateV3Schema.safeParse(f.state).success, true);
  localStorage.setItem(ACTIVE, JSON.stringify(f.state)); writeEntries(f.entries);
  return structuredClone(f);
}
function linkJournal(state, day, id, overrides = {}) {
  const session = state.activePlan.sessions.find(s => s.day === day && s.slot === 'AM');
  const draft = V.createPlannedSessionLogDraft(state, session, now);
  assert.ok(draft, 'Public link creation must succeed');
  return { ...V.replanFixture().entries[0], id, title: 'SYNTHETIC ONLY', memo: '',
    date: draft.link.plannedDate, savedAt: now, plannedSessionLink: draft.link, ...overrides };
}
function prepareManual(day = 4, state = current()) {
  for (const row of V.ALL_WORKOUT_CATALOG.filter(e => e.family === 'BASE')) {
    const prepared = V.prepareCatalogReplacement({ state, entries: entries(), today: '2026-09-29', now,
      address: { day, slot: 'AM' }, catalogId: row.id,
      inputs: { eventDistanceM: 5000, experience: state.intake.experienceBand, availableSeconds: null,
        confirmedRequirements: [], fiveK: null, segmentPaces: [] },
      acceptLonger: true, acceptStronger: true, journalGuard: null });
    if (prepared.kind === 'ready') return prepared.proposal;
  }
  throw new Error(`No eligible different BASE replacement for day ${day}`);
}
async function manual(day = 4) {
  const proposal = prepareManual(day), before = structuredClone(proposal.before);
  const applied = await V.applyCatalogReplacement(proposal, true);
  assert.equal(applied.kind, 'applied', JSON.stringify(applied));
  assert.deepEqual(proposal.before, before, 'Input state must not mutate');
  assert.deepEqual(current(), proposal.after);
  return proposal;
}
function prepareReplan(entryId, action = 'REDUCE') {
  const result = V.prepareExecutionReplan({ state: current(), entries: entries(), entryId,
    today: '2026-09-29', now, noFixedFutureCommitments: true, journalGuard: null });
  return { result, proposal: result.kind === 'ready' ? result.proposals.find(p => p.action === action) : undefined };
}
async function replan(entryId, action = 'REDUCE') {
  const p = prepareReplan(entryId, action);
  assert.ok(p.proposal, `Replan ${action} must be offered: ${JSON.stringify(p.result)}`);
  const result = await V.applyExecutionReplan(p.proposal, '2026-09-29', true);
  assert.equal(result.kind, 'applied', JSON.stringify(result));
  assert.deepEqual(current(), p.proposal.after);
  return p.proposal;
}
function assertOriginal(entry, expected) {
  const read = V.readJournalOriginalPlan(entry);
  assert.equal(read.kind, 'matched'); assert.equal(read.source, 'ARCHIVED');
  assert.deepEqual(read.state, expected, 'Full original including progress and prior receipt must match');
  const session = expected.activePlan.sessions.find(s => s.day === entry.plannedSessionLink.sessionDay && s.slot === entry.plannedSessionLink.sessionSlot);
  assert.deepEqual(read.session, session);
  assert.notEqual(V.reviewPlanExecution(entry, read).status, 'SOURCE_UNAVAILABLE');
}
function assertArchive(states) {
  const history = JSON.parse(localStorage.getItem(HISTORY) ?? '[]');
  assert.equal(V.planHistoryListSchema.safeParse(history).success, true);
  const read = V.readArchivedOriginalPlans(); assert.equal(read.kind, 'loaded');
  for (const state of states) assert.ok(read.plans.some(p => V.replanFingerprint(p) === V.replanFingerprint(state)));
  return history;
}
async function boundary(id, name, run) {
  reset(); observations = {};
  try {
    await run(); results.push({ id, name, status: 'PASS', observations });
    console.log(`PASS ${id}: ${name}`);
  } catch (error) {
    results.push({ id, name, status: 'FAIL', observations, error: { name: error.name, message: error.message,
      expected: error.expected, actual: error.actual } });
    console.log(`FAIL ${id}: ${name}\n  ${error.message.slice(0, 650)}`);
  }
}

await boundary('B01', 'Two manual replacements preserve first and intermediate journal originals', async () => {
  const f = seed(), journals = localStorage.getItem(JOURNAL);
  const first = await manual();
  const intermediate = linkJournal(current(), 1, 'synthetic-intermediate');
  writeEntries([...entries(), intermediate]);
  const beforeSecondJournal = localStorage.getItem(JOURNAL);
  const second = await manual();
  assertOriginal(f.entries[0], f.state); assertOriginal(intermediate, first.after);
  assert.deepEqual(current().progress, f.state.progress);
  assert.deepEqual(current().periodization, f.state.periodization);
  assert.equal(localStorage.getItem(JOURNAL), beforeSecondJournal);
  assert.equal(assertArchive([f.state, first.after]).length, 2);
  assert.notDeepEqual(first.after.activePlan.sessions.find(s => s.day === 4), second.after.activePlan.sessions.find(s => s.day === 4));
  note('originalJournalStillPresent', entries().some(e => JSON.stringify(e) === JSON.stringify(JSON.parse(journals)[0])));
  note('replacementIds', [first.after.catalogReplacement.replacement.prescription.catalogWorkout.catalogId,
    second.after.catalogReplacement.replacement.prescription.catalogWorkout.catalogId]);
  note('archiveCount', 2);
});
await boundary('B02', 'Execution replan then manual replacement preserves both originals and lineage', async () => {
  const f = seed(), first = await replan(f.entryId);
  const intermediate = linkJournal(current(), 1, 'synthetic-after-replan');
  writeEntries([...entries(), intermediate]);
  await manual();
  assertOriginal(f.entries[0], f.state); assertOriginal(intermediate, first.after);
  assert.deepEqual(current().periodization, f.state.periodization);
  assert.deepEqual(current().progress, f.state.progress);
  assert.equal(assertArchive([f.state, first.after]).length, 2);
  note('oldReplanReceiptArchived', !!V.readJournalOriginalPlan(intermediate).state.executionReplan);
  note('currentHasOnlyManualReceipt', !!current().catalogReplacement && !current().executionReplan);
});
await boundary('B03', 'Manual replacement must not strand the unchanged original execution-review journal', async () => {
  const f = seed(); await manual();
  assertOriginal(f.entries[0], f.state);
  const before = rawSnapshot(), prepared = prepareReplan(f.entryId);
  note('originalLookup', V.readJournalOriginalPlan(f.entries[0]).kind);
  note('replanResult', prepared.result);
  assert.deepEqual(rawSnapshot(), before, 'Preparation must not write');
  assert.equal(prepared.result.kind, 'ready', 'Exact archived source journal for an unchanged past slot should remain usable');
});
await boundary('B04', 'Manual replacement then replan using a new current-version journal preserves prior catalog structure', async () => {
  const f = seed(), first = await manual();
  const trigger = linkJournal(current(), 1, 'synthetic-current-version-trigger');
  writeEntries([...entries(), trigger]);
  const planned = first.after.activePlan.sessions.find(s => s.day === 4);
  await replan(trigger.id);
  assertOriginal(f.entries[0], f.state); assertOriginal(trigger, first.after);
  assert.deepEqual(current().activePlan.sessions.find(s => s.day === 4), planned);
  assert.deepEqual(current().progress, f.state.progress);
  assert.deepEqual(current().periodization, f.state.periodization);
  assert.equal(assertArchive([f.state, first.after]).length, 2);
  note('catalogBindingPreserved', planned.prescription.catalogWorkout.catalogId);
});
await boundary('B05', 'Mixed replan must protect actual-date unlinked and unknown-slot journal entries', async () => {
  const variants = [];
  for (const slot of ['AM', 'SINGLE']) {
    reset(); seed(); await manual();
    const trigger = linkJournal(current(), 1, `synthetic-trigger-${slot}`);
    const unlinked = { ...trigger, id: `synthetic-actual-future-${slot}`, date: '2026-09-30', activitySlot: slot };
    delete unlinked.plannedSessionLink;
    writeEntries([...entries(), trigger, unlinked]);
    const protectedSlots = V.catalogProtectedSlots(current(), entries(), '2026-09-29');
    assert.ok(protectedSlots.some(s => s.day === 3 && s.slot === 'AM'), 'Manual path positive protection control');
    const prepared = prepareReplan(trigger.id);
    assert.ok(prepared.proposal, 'Replan must otherwise be eligible');
    const before = current().activePlan.sessions.find(s => s.day === 3);
    const journalBytes = localStorage.getItem(JOURNAL);
    const result = await V.applyExecutionReplan(prepared.proposal, '2026-09-29', true);
    const after = current().activePlan.sessions.find(s => s.day === 3);
    variants.push({ slot, manualProtected: true, replanProtected: prepared.proposal.after.executionReplan.protectedSlots.some(s => s.day === 3),
      apply: result.kind, unchanged: V.replanFingerprint(before) === V.replanFingerprint(after),
      beforeDuration: before.prescription.durationMinutes, afterDuration: after.prescription.durationMinutes });
    assert.equal(localStorage.getItem(JOURNAL), journalBytes);
  }
  note('variants', variants);
  assert.ok(variants.every(v => v.unchanged || v.apply !== 'applied'), 'Actual recorded future occurrence must not be rewritten by replan');
});

function generatedSeed() {
  const intake = { eventGroup: 'FIVE_K', eventDistanceM: 5000, competitionDivision: 'OPEN',
    experienceBand: 'DEVELOPING', availableDayCount: 5, requestedFrameLength: 9, trainingFocus: 'VO2_INTENT',
    secondSessionMode: 'SINGLE_SESSION_ONLY', trainingTimePreference: 'VARIES', selectedDetailedTemplateRef: null };
  // Use the maintained plain-RPE formation fixture, not a new numeric policy.
  const request = V.baseRequest();
  const candidates = V.expectGenerated(V.generatePlanCandidates({ ...request,
    profile: { ...request.profile, eventGroup: 'FIVE_K', eventDistanceM: 5000 }, selectedEnergyIntent: 'VO2_INTENT' }));
  const base = candidates.candidates[0];
  const selected = V.selectPlanForActivation(base.candidateId, candidates, request.safetyGate, { ...intake, requestedFrameLength: 9.5 });
  assert.equal(selected.kind, 'selected');
  const state = { ...selected.state, intake: { ...selected.state.intake, startDate: '2026-09-28' },
    adaptationScope: { athleteId: 'local-athlete', eventDistanceM: 5000, pairId: base.pairId, selectedDetailedTemplateRef: null },
    progress: [{ sessionDay: 1, sessionSlot: 'AM', state: 'COMPLETED' }] };
  assert.equal(V.savePlanBetaState(state).ok, true);
  assert.equal(V.savePlanAdaptationContext(candidates.candidates, state.activePlan.candidateId).ok, true);
  return { state, generated: candidates };
}
async function nextPreparation(state = current()) {
  const safety = V.evaluateActivePlanAdaptationSafety(state, 'NO_KNOWN_RISK', new Date(now));
  assert.equal(safety.kind, 'evaluated');
  return { safety, result: await V.prepareNextFrameAdaptation({ state, reason: 'EXPLICIT_REQUEST', record: null, safety, operationAt: now }) };
}
await boundary('B06', 'Two manual replacements must keep explicit next-frame adaptation reachable', async () => {
  const f = generatedSeed(), baseline = await nextPreparation();
  assert.equal(baseline.result.kind, 'ready', `Positive next-frame control: ${JSON.stringify(baseline.result)}`);
  const day = current().activePlan.sessions.find(s => s.day > 2 && s.role === 'EASY').day;
  const original = linkJournal(current(), 1, 'synthetic-generated-original'); writeEntries([original]);
  const oldContext = localStorage.getItem(CONTEXT);
  await manual(day); await manual(day);
  const after = await nextPreparation();
  assertOriginal(original, f.state);
  note('before', baseline.result.kind); note('after', after.result);
  note('contextUnchanged', localStorage.getItem(CONTEXT) === oldContext);
  note('contextCandidateMatchesCurrent', JSON.parse(localStorage.getItem(CONTEXT)).activeCandidateId === current().activePlan.candidateId);
  assert.equal(after.result.kind, 'ready', 'User-requested next frame must not lose its context after W2');
});
await boundary('B07', 'Ordinary next-frame archive and generation preserve original, results and program lineage', async () => {
  const control = seed();
  const controlArchive = await V.archiveAndClearActivePlanWithLock(current().activePlan.candidateId);
  assert.equal(controlArchive.kind, 'archived');
  const controlGenerated = V.generatePlanFromDraft(controlArchive.intake, 'NO_KNOWN_RISK');
  assert.equal(controlGenerated.kind, 'generated');
  const controlSelected = V.selectPlanForActivation(controlGenerated.generated.candidates[0].candidateId, controlGenerated.generated,
    controlGenerated.gate, controlGenerated.intake, controlGenerated.athleteEvidence);
  assert.equal(controlSelected.kind, 'selected');
  note('noReplacementControlAlsoResetsLineage', controlSelected.state.periodization.programLineageId !== control.state.periodization.programLineageId);
  reset();
  const f = seed(); await manual(); await manual();
  const final = current();
  const archived = await V.archiveAndClearActivePlanWithLock(final.activePlan.candidateId);
  assert.equal(archived.kind, 'archived', JSON.stringify(archived));
  assertOriginal(f.entries[0], f.state);
  assert.equal(assertArchive([f.state, final]).length, 3);
  const continuity = V.loadPreviousContinuity();
  assert.deepEqual(continuity.progressStateCounts.find(p => p.state === 'COMPLETED'), { state: 'COMPLETED', count: 1 });
  now = '2026-10-07T03:00:00.000Z';
  const generated = V.generatePlanFromDraft({ ...archived.intake, startDate: '2026-10-07' }, 'NO_KNOWN_RISK');
  assert.equal(generated.kind, 'generated');
  const selected = V.selectPlanForActivation(generated.generated.candidates[0].candidateId, generated.generated, generated.gate,
    generated.intake, generated.athleteEvidence);
  assert.equal(selected.kind, 'selected'); assert.equal(V.savePlanBetaState(selected.state).ok, true);
  assertOriginal(f.entries[0], f.state);
  note('continuity', continuity); note('beforePeriodization', final.periodization); note('afterPeriodization', selected.state.periodization);
  note('candidateCarriesPriorResults', selected.state.activePlan.candidateId.includes('completed-1'));
  assert.equal(selected.state.periodization.programLineageId, final.periodization.programLineageId, 'Next-frame UI route must preserve the program identity');
  assert.equal(selected.state.periodization.frameOrdinal, final.periodization.frameOrdinal + 1);
});
await boundary('B08', 'Accepted successor made before W2 is rejected without writes after replacement', async () => {
  generatedSeed();
  const control = await nextPreparation(); assert.equal(control.result.kind, 'ready');
  const controlAccepted = await V.acceptPreparedNextFrameAdaptation({ prepared: control.result.prepared, predecessorState: current(),
    safety: control.safety, operationAt: now });
  assert.equal(controlAccepted.kind, 'accepted');
  const controlState = current();
  now = '2026-10-10T03:00:00.000Z';
  const controlActivated = await V.activateAcceptedNextFrameSuccessor({ currentCheck: 'NO_KNOWN_RISK', activatedAt: now, localDate: '2026-10-10' });
  note('positiveActivation', controlActivated.kind);
  note('positiveActivationResult', controlActivated.kind === 'activated' ? {
    sameProgram: controlActivated.state.periodization.programLineageId === controlState.periodization.programLineageId,
    frameOrdinal: controlActivated.state.periodization.frameOrdinal,
    historyCount: V.readArchivedOriginalPlans().kind === 'loaded' ? V.readArchivedOriginalPlans().plans.length : null,
  } : controlActivated);
  assert.equal(controlActivated.kind, 'activated', JSON.stringify(controlActivated));
  assert.equal(controlActivated.state.periodization.programLineageId, controlState.periodization.programLineageId);
  assert.equal(controlActivated.state.periodization.frameOrdinal, controlState.periodization.frameOrdinal + 1);
  assertArchive([controlState]);
  reset();
  generatedSeed(); const before = current(), prepared = await nextPreparation();
  assert.equal(prepared.result.kind, 'ready');
  const accepted = await V.acceptPreparedNextFrameAdaptation({ prepared: prepared.result.prepared, predecessorState: before,
    safety: prepared.safety, operationAt: now });
  assert.equal(accepted.kind, 'accepted', JSON.stringify(accepted));
  const pending = localStorage.getItem(PENDING); assert.ok(pending);
  const day = current().activePlan.sessions.find(s => s.day > 2 && s.role === 'EASY').day;
  await manual(day);
  const changed = current();
  assert.equal(localStorage.getItem(PENDING), pending);
  now = '2026-10-10T03:00:00.000Z';
  const snapshot = rawSnapshot();
  const result = await V.activateAcceptedNextFrameSuccessor({ currentCheck: 'NO_KNOWN_RISK', activatedAt: now, localDate: '2026-10-10' });
  note('activation', result); assert.notEqual(result.kind, 'activated');
  assert.deepEqual(rawSnapshot(), snapshot); assert.deepEqual(current(), changed);
});
const afterHash = sourceFingerprint();
const summary = { uniqueBoundaries: results.length, pass: results.filter(r => r.status === 'PASS').length,
  fail: results.filter(r => r.status === 'FAIL').length };
writeFileSync(output, JSON.stringify({ scope: 'Synthetic local public-function integration only; no account/SQL/network/production verification',
  timezone: process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone, node: process.version,
  mutation, mutationApplications, networkAttempts,
  sourceFingerprintBefore: beforeHash, sourceFingerprintAfter: afterHash, sourceUnchanged: beforeHash === afterHash,
  compiledCode: 'Memory only; no generated bundle saved', summary, results }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(summary));
assert.equal(beforeHash, afterHash, 'Product/source files changed during review');
assert.equal(networkAttempts, 0, 'Unexpected network attempt');
assert.equal(mutationApplications, mutation === 'none' ? 0 : 1);
dom.window.close(); globalThis.Date = RealDate; globalThis.fetch = originalFetch;
process.exitCode = summary.fail ? 1 : 0;
