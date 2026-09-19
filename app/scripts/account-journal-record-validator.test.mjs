import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildAccountJournalRecordValidator } from './build-account-journal-record-validator.mjs'

const app = new URL('../', import.meta.url)
const generatedUrl = new URL('../../supabase/functions/_shared/account-journal-record-validator.mjs', import.meta.url)
const bundle = await build({
  stdin: { contents: `
    export * from './src/domain/account/account-journal-record-schema.ts';
    export { waitingJournal } from './src/test/progressive-journal-fixture.ts';
    export { privateEntry } from './src/domain/private-memo-test-fixtures.ts';
    export { parseJournalEntryForWrite } from './src/domain/journal-schema.ts';
    export * from './src/domain/import/file-observation.ts';
    export { createPlannedSessionLogDraft } from './src/domain/planned-session-link.ts';
  `, resolveDir: fileURLToPath(app), loader: 'ts' },
  tsconfig: fileURLToPath(new URL('tsconfig.json', app)),
  bundle: true, write: false, platform: 'node', format: 'esm',
})
const source = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const server = await import(generatedUrl.href)
const record = (entry = source.waitingJournal()) => ({ version: 2, state: 'FINALIZED', kind: 'JOURNAL', entry })
const reverseKeys = value => Array.isArray(value) ? value.map(reverseKeys)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)])) : value

const observation = () => source.buildFileObservation({
  format: 'tcx', sourceProfile: 'TCX_ACTIVITY_V1', parserVersion: 'tcx-v1',
  sourceActivityId: 'synthetic-activity', date: '2026-09-02', startedAt: null, timeZone: null,
  sport: 'RUNNING', distanceMeters: 5000, durationSeconds: 1800, durationMeaning: 'SOURCE_DEFINED',
  laps: [{ sourceIndex: 0, distanceMeters: 5000, durationSeconds: 1800, durationMeaning: 'SOURCE_DEFINED', kind: 'UNKNOWN' }],
  confirmation: { sport: null, durationMeaning: null },
})

for (const [name, codec] of [['source', source], ['server', server]]) {
  test(`${name}: correction preserves independently EXPLICIT decimal summaries and backup eligibility`, () => {
    const { schemaVersion, source: origin, sourceObservationKey, contentRevisionFingerprint, completeness, sourceIdentityFingerprint, ...input } = observation()
    const fileObservation = source.buildFileObservation({ ...input, distanceMeters: 5000.123, durationSeconds: 1500.456,
      laps: [{ ...input.laps[0], distanceMeters: 5000.123, durationSeconds: 1500.456 }] })
    const manual = source.waitingJournal({ ...source.toFileObservationSummary(fileObservation), distanceKm: '5.000123', durationMin: '25.0076', objectiveDataState: 'CONFIRMED',
      fieldProvenance: { ...source.waitingJournal().fieldProvenance,
        distanceKm: { provenance: 'EXPLICIT' }, durationMin: { provenance: 'EXPLICIT' } } })
    const attached = { ...record(manual), version: 3, entry: { ...manual, fileObservation } }
    assert.equal(codec.validateAccountJournalRecordUpdate(record(manual), attached, 'FILE_OBSERVATION'), true)
    assert.equal(codec.validateInitialFileObservationRecord(attached), true)
    const replacement = source.buildFileObservation({ ...input, sourceIdentityFingerprint: fileObservation.sourceIdentityFingerprint,
      distanceMeters: 6000.123, durationSeconds: 2400.456,
      laps: [{ ...input.laps[0], distanceMeters: 6000.123, durationSeconds: 2400.456 }] })
    const corrected = codec.correctAccountJournalImportedObservation(attached, fileObservation.contentRevisionFingerprint,
      replacement, ['distanceMeters', 'durationSeconds', 'laps'])
    assert.ok(corrected)
    assert.equal(corrected.entry.distanceKm, '5.000123')
    assert.equal(corrected.entry.durationMin, '25.0076')
    assert.equal(corrected.entry.avgPace, '')
    assert.deepEqual(corrected.entry.fieldProvenance, manual.fieldProvenance)
    assert.deepEqual(corrected.entry.fileObservation, replacement)
    assert.equal(codec.validateInitialFileObservationRecord(corrected), true)
    const relabeled = structuredClone(attached)
    relabeled.entry.fieldProvenance.distanceKm = { provenance: 'DERIVED', derivedFrom: ['import:activity-file'], derivationRuleId: 'import:tcx' }
    assert.equal(codec.validateAccountJournalRecordUpdate(record(manual), relabeled, 'FILE_OBSERVATION'), false)
  })
  test(`${name}: V3 relation codec preserves strict display-only history and prevents ordinary mutation`, () => {
    const fileObservation = observation()
    const session = { day: 1, slot: 'AM', role: 'EASY', plannedEnergyIntent: 'BASE_INTENT', prescription: null }
    const link = source.createPlannedSessionLogDraft({ intake: { startDate: fileObservation.date }, generatedAt: '2026-09-02T00:00:00Z',
      activePlan: { candidateId: 'synthetic', sessions: [session] } }, session, '2026-09-02T00:00:00Z').link
    const relation = { schemaVersion: 1, relationId: '10000000-0000-4000-8000-000000000001', journalId: 'waiting',
      journalRevisionAtConfirmation: 1, contentRevisionFingerprint: fileObservation.contentRevisionFingerprint,
      observationInterpretationFingerprint: `sha256:${'a'.repeat(64)}`, original: { planFingerprint: `sha256:${'b'.repeat(64)}`, session: link },
      mappingVersion: 1, mappingConfirmation: 'USER_CONFIRMED', createdAt: '2026-09-02T00:00:00Z', releasedAt: null,
      segmentMappings: [{ planSegmentId: 'main/0/0', sourceLapIndex: 0, confirmedKind: 'WORK', confirmedTargetUnit: 'DISTANCE',
        confirmedDurationMeaning: 'TIMER', confirmedRecoveryMode: null }] }
    const value = { ...record(source.waitingJournal({ id: relation.journalId, fileObservation, ...source.toFileObservationSummary(fileObservation), objectiveDataState: 'CONFIRMED' })), version: 3 }
    const linked = { ...value, entry: { ...value.entry, comparisonRelations: [relation] } }
    assert.equal(codec.validateAccountJournalRecord(linked), true)
    assert.equal(codec.validateAccountJournalRecord({ ...linked, version: 2 }), false)
    assert.equal(codec.validateAccountJournalRecord({ ...linked, entry: { ...linked.entry, comparisonRelations: [relation, relation] } }), false)
    assert.equal(codec.validateAccountJournalRecord({ ...linked, entry: { ...linked.entry, comparisonRelations: [{ ...relation, authority: 'EXECUTE' }] } }), false)
    assert.equal(codec.validateAccountJournalRecordUpdate(value, linked), false)
    assert.equal(codec.validateAccountJournalRecordUpdate(linked, value), false)
    assert.equal(codec.validateAccountJournalRecordUpdate(linked, { ...linked, entry: { ...linked.entry, memo: 'Changed memo', memoPurpose: 'ANALYZABLE_TRAINING_NOTE' } }), true)
    const request = { action: 'confirmComparisonRelation', documentId: '20000000-0000-4000-8000-000000000001',
      operationId: '30000000-0000-4000-8000-000000000001', expectedRevision: 1, relation }
    assert.deepEqual(codec.applyAccountJournalComparisonMutation(value, request), linked)
    assert.equal(codec.applyAccountJournalComparisonMutation(linked, request), null)
    const released = codec.applyAccountJournalComparisonMutation(linked, { action: 'releaseComparisonRelation', documentId: request.documentId,
      operationId: request.operationId, expectedRevision: 2, relationId: relation.relationId, releasedAt: '2026-09-03T00:00:00Z' })
    assert.equal(released.entry.comparisonRelations[0].releasedAt, '2026-09-03T00:00:00Z')
    assert.equal(codec.validateAccountJournalRecordUpdate(linked, released), false)
    const { schemaVersion, source: origin, contentRevisionFingerprint, sourceObservationKey, completeness, ...input } = fileObservation
    const replacement = source.buildFileObservation({ ...input, distanceMeters: 5100, laps: [{ ...input.laps[0], distanceMeters: 5100 }] })
    const corrected = codec.correctAccountJournalImportedObservation(linked, contentRevisionFingerprint, replacement, ['distanceMeters', 'laps'])
    assert.deepEqual(corrected.entry.comparisonRelations, [relation])
  })
  test(`${name}: correction changes file-owned pace and its provenance together without promoting source-defined time`, () => {
    const fileObservation = observation(), summary = source.toFileObservationSummary(fileObservation)
    const provenance = { provenance: 'DERIVED', derivedFrom: ['import:activity-file'], derivationRuleId: 'import:tcx' }
    const previous = { ...record(source.waitingJournal({ ...summary, objectiveDataState: 'CONFIRMED', fileObservation,
      fieldProvenance: { ...source.waitingJournal().fieldProvenance, distanceKm: provenance, durationMin: provenance } })), version: 3 }
    const { schemaVersion, source: origin, sourceObservationKey, contentRevisionFingerprint, completeness, ...input } = fileObservation
    const confirmed = source.buildFileObservation({ ...input, confirmation: { sport: null, durationMeaning: 'TIMER' } })
    const corrected = codec.correctAccountJournalImportedObservation(previous, contentRevisionFingerprint, confirmed, ['confirmation'])
    assert.ok(corrected)
    assert.equal(corrected.entry.avgPace, '6:00')
    assert.deepEqual(corrected.entry.fieldProvenance.avgPace, provenance)
    assert.equal(corrected.entry.objectiveDataState, previous.entry.objectiveDataState)
    const reverted = codec.correctAccountJournalImportedObservation(corrected, confirmed.contentRevisionFingerprint, fileObservation, ['confirmation'])
    assert.ok(reverted)
    assert.equal(reverted.entry.avgPace, '')
    assert.deepEqual(reverted.entry.fieldProvenance.avgPace, { provenance: 'MISSING' })
    assert.deepEqual(reverted, previous)
  })
  test(`${name}: V2 stays V2; V3 preserves evidence; V2 and future fields reject strictly`, () => {
    const existing = record()
    const fileObservation = observation()
    const next = { ...existing, version: 3, entry: { ...existing.entry, fileObservation } }
    assert.equal(codec.validateAccountJournalRecord(existing), true)
    assert.equal(codec.validateAccountJournalRecord(next), true)
    assert.equal(codec.validateAccountJournalRecord({ ...next, version: 2 }), false)
    assert.equal(codec.validateAccountJournalRecord({ ...next, entry: { ...next.entry, comparisonRelations: [] } }), false)
    assert.equal(codec.validateAccountJournalRecord({ ...next, fileObservation }), false)
    assert.equal(codec.validateAccountJournalRecordUpdate(next, existing), false)
    assert.equal(codec.validateAccountJournalRecordUpdate(existing, next), false)
    assert.equal(codec.validateAccountJournalRecordUpdate(next, { ...next, entry: { ...next.entry, title: 'Changed' } }), true)
    assert.equal(codec.validateAccountJournalRecordUpdate(existing, existing), true)
    assert.equal(source.parseAccountJournalRecord(existing).version, 2)
    assert.deepEqual(source.parseAccountJournalRecord(next).entry.fileObservation, fileObservation)
  })
  test(`${name}: explicit attachment preserves memo, RPE, completion, link and unrelated provenance`, () => {
    const previous = record(source.waitingJournal({ rpe: 6, memo: 'Synthetic private body', memoPurpose: 'PRIVATE_SELF_ONLY' }))
    const fileObservation = observation()
    const next = { ...previous, version: 3, entry: { ...previous.entry, fileObservation,
      ...source.toFileObservationSummary(fileObservation), objectiveDataState: 'CONFIRMED' } }
    assert.equal(codec.validateInitialFileObservationRecord(next), true)
    assert.equal(codec.validateAccountJournalRecordUpdate(previous, next, 'FILE_OBSERVATION'), true)
    assert.equal(codec.validateAccountJournalRecordUpdate(previous, next), false)
    assert.equal(codec.validateAccountJournalRecordUpdate(previous, next, 'MIGRATION'), false)
    for (const changed of [{ memo: 'Forbidden change' }, { rpe: 7 }, { activityOutcome: 'PARTIAL' }, { date: '2026-09-03' },
      { fieldProvenance: { ...next.entry.fieldProvenance, activitySlot: { provenance: 'MISSING' } } }, { distanceKm: '7' }]) {
      assert.equal(codec.validateAccountJournalRecordUpdate(previous, { ...next, entry: { ...next.entry, ...changed } }, 'FILE_OBSERVATION'), false)
    }
    assert.equal(codec.validateAccountJournalRecordUpdate(next, { ...next, entry: { ...next.entry, distanceKm: '7' } }), false)
  })
  test(`${name}: correction deterministically preserves all nonobservation fields and confirms exact changes`, () => {
    const fileObservation = observation()
    const session = { day: 1, slot: 'AM', role: 'EASY', plannedEnergyIntent: 'BASE_INTENT', prescription: null }
    const draft = source.createPlannedSessionLogDraft({ intake: { startDate: fileObservation.date }, generatedAt: '2026-09-02T00:00:00Z',
      activePlan: { candidateId: 'synthetic', sessions: [session] } }, session, '2026-09-02T00:00:00Z')
    assert.ok(draft)
    const previous = { ...record(source.waitingJournal({ rpe: 6, memo: 'Synthetic private body', memoPurpose: 'PRIVATE_SELF_ONLY',
      plannedSessionLink: draft.link, planExecutionRelation: 'AS_PLANNED', objectiveDataState: 'CONFIRMED',
      fieldProvenance: { ...source.waitingJournal().fieldProvenance, plannedSessionLink: { provenance: 'EXPLICIT' }, rpe: { provenance: 'EXPLICIT' } },
      ...source.toFileObservationSummary(fileObservation), fileObservation })), version: 3 }
    assert.equal(codec.validateAccountJournalRecord(previous), true)
    const { schemaVersion, source: origin, contentRevisionFingerprint, sourceObservationKey, completeness, ...input } = fileObservation
    const replacement = source.buildFileObservation({ ...input, distanceMeters: 5100, laps: [{ ...input.laps[0], distanceMeters: 5100 }] })
    const result = codec.correctAccountJournalImportedObservation(previous, contentRevisionFingerprint, replacement, ['laps', 'distanceMeters'])
    assert.deepEqual(result, { ...previous, entry: { ...previous.entry, ...source.toFileObservationSummary(replacement), fileObservation: replacement } })
    assert.equal(codec.correctAccountJournalImportedObservation(previous, contentRevisionFingerprint, replacement, ['distanceMeters']), null)
    assert.equal(codec.correctAccountJournalImportedObservation(previous, contentRevisionFingerprint, replacement, ['laps', 'distanceMeters', 'date']), null)
    assert.equal(codec.correctAccountJournalImportedObservation(previous, contentRevisionFingerprint, { ...replacement, contentRevisionFingerprint: `sha256:${'0'.repeat(64)}` }, ['laps', 'distanceMeters']), null)
    assert.equal(codec.correctAccountJournalImportedObservation(previous, contentRevisionFingerprint, { ...replacement, parserVersion: 'upgraded' }, ['laps', 'distanceMeters']), null)
    assert.equal(codec.correctAccountJournalImportedObservation(previous, contentRevisionFingerprint, fileObservation, ['laps']), null)
  })
}

for (const [name, validate] of [
  ['source', source.validateAccountJournalRecord],
  ['generated server', server.validateAccountJournalRecord],
  ['union-ready schema', value => source.accountJournalRecordSchema.safeParse(value).success],
]) {
  test(`${name}: accepts existing quick and private journal fixtures without mutation`, () => {
    for (const entry of [source.waitingJournal(), source.privateEntry('p', 'Synthetic private body')]) {
      const value = record(entry)
      const before = structuredClone(value)
      assert.notEqual(source.parseJournalEntryForWrite(entry), null)
      assert.equal(validate(value), true)
      assert.equal(validate(reverseKeys(value)), true)
      assert.deepEqual(value, before)
    }
  })
  const invalid = [
    ['draft', value => { value.state = 'DRAFT' }],
    ['version', value => { value.version = 1 }],
    ['plan document', value => { value.kind = 'PLAN' }],
    ['envelope unknown', value => { value.body = 'Synthetic private body' }],
    ['entry unknown', value => { value.entry.unknown = true }],
    ['unknown undefined', value => { value.entry.unknown = undefined }],
    ['nested unknown', value => { value.entry.fieldProvenance.rpe.extra = true }],
    ['purpose transform', value => { value.entry.memoPurpose = 'INVALID' }],
    ['missing memo purpose', value => { value.entry.memo = 'Synthetic private body' }],
    ['impossible date', value => { value.entry.date = '2026-02-30' }],
    ['empty identity', value => { value.entry.id = '' }],
    ['synced write', value => { value.entry.syncState = 'synced' }],
    ['effort conflict', value => { value.entry.rpe = 6; value.entry.rpeBand = 'RPE_5_6' }],
    ['body unanswered', value => { value.entry.painCheckStatus = 'UNANSWERED' }],
    ['body signal without level', value => { value.entry.painCheckStatus = 'SIGNAL_REPORTED' }],
    ['objective data missing', value => { value.entry.objectiveDataState = 'CONFIRMED' }],
    ['plan link missing', value => { value.entry.planExecutionRelation = 'AS_PLANNED' }],
    ['wrong provenance field', value => { value.entry.fieldProvenance.memo = { provenance: 'EXPLICIT' } }],
    ['wrong derivation input', value => { value.entry.fieldProvenance.planExecutionRelation.derivedFrom = ['memo'] }],
    ['wrong derivation rule', value => { value.entry.fieldProvenance.planExecutionRelation.derivationRuleId = 'INVALID' }],
    ['rest with performance', value => { value.entry.activityOutcome = 'RESTED' }],
    ['nonfinite', value => { value.entry.rpe = Infinity }],
    ['cycle', value => { value.entry.loop = value }],
  ]
  for (const [label, mutate] of invalid) test(`${name}: rejects ${label}`, () => {
    const value = record()
    mutate(value)
    assert.equal(validate(value), false)
  })
  test(`${name}: rejects accessors without invoking them or exposing errors`, () => {
    const value = record()
    let invoked = false
    Object.defineProperty(value.entry, 'memo', { enumerable: true, get() { invoked = true; throw new Error('Synthetic private body') } })
    assert.equal(validate(value), false)
    assert.equal(invoked, false)
  })
}

test('schema reports only a fixed generic issue without body or field paths', () => {
  const result = source.accountJournalRecordSchema.safeParse({ ...record(), privateField: 'Synthetic private body' })
  assert.equal(result.success, false)
  assert.deepEqual(result.error.issues, [{ code: 'custom', message: 'Invalid account journal record', path: [] }])
})

for (const [name, validate] of [['source', source.validateAccountJournalRecordUpdate], ['server', server.validateAccountJournalRecordUpdate]]) {
  test(`${name}: edits preserve identity, date and immutable provenance`, () => {
    const previous = record(source.privateEntry('p', 'Synthetic old body'))
    const next = structuredClone(previous)
    next.entry.memo = 'Synthetic changed body'
    assert.equal(validate(previous, next), true)
    for (const field of ['id', 'date']) {
      const changed = structuredClone(next)
      changed.entry[field] = field === 'id' ? 'other' : '2026-09-07'
      assert.equal(server.validateAccountJournalRecord(changed), true)
      assert.equal(validate(previous, changed), false)
    }
    assert.equal(validate(null, next), false)
    const invented = structuredClone(next)
    invented.entry.fieldProvenance = {}
    assert.equal(server.validateAccountJournalRecord(invented), true)
    assert.equal(validate(previous, invented), false)
  })
}

test('generated bytes are reproducible and all runtime imports are bundled', async () => {
  const result = await buildAccountJournalRecordValidator()
  assert.equal(await readFile(generatedUrl, 'utf8'), result.outputFiles[0].text)
  assert.equal(Object.values(result.metafile.outputs).flatMap(output => output.imports).length, 0)
  assert.deepEqual(Object.keys(server), ['FILE_OBSERVATION_CORRECTION_FIELDS', 'applyAccountJournalComparisonMutation',
    'confirmComparisonRelationRequestSchema', 'correctAccountJournalImportedObservation', 'parseFileObservation',
    'releaseComparisonRelationRequestSchema', 'resolveComparisonOriginalFromPlanCollection', 'resolveComparisonOriginalFromPlanDocument',
    'validateAccountJournalComparisonConfirmation', 'validateAccountJournalComparisonRestore', 'validateAccountJournalRecord', 'validateAccountJournalRecordUpdate', 'validateInitialFileObservationRecord'])
  const inputs = Object.keys(result.metafile.inputs).filter(name => !name.includes('node_modules/')).sort()
  assert.deepEqual(inputs, [
    'app/account-journal-record-server-entry.ts',
    'app/src/domain/account/account-journal-projection.ts',
    'app/src/domain/account/account-journal-record-schema.ts',
    'app/src/domain/account/account-plan-collection-schema.ts',
    'app/src/domain/account/account-plan-document-schema.ts',
    'app/src/domain/account/account-plan-historical.ts',
    'app/src/domain/account/local-account-scope.ts',
    'app/src/domain/account/local-journal-ownership.ts',
    'app/src/domain/adjusted-method-resolution-v3.ts',
    'app/src/domain/adjusted-method-resolution.ts',
    'app/src/domain/adjusted-method-snapshot-v3.ts',
    'app/src/domain/adjusted-method-snapshot.ts',
    'app/src/domain/adjusted-plan-candidate.ts',
    'app/src/domain/adjusted-plan-multi-candidate-v3.ts',
    'app/src/domain/adjusted-plan-multi-review-v3.ts',
    'app/src/domain/adjusted-plan-review-policy.ts',
    'app/src/domain/adjusted-plan-review-v3.ts',
    'app/src/domain/adjusted-plan-storage-schema.ts',
    'app/src/domain/adjusted-plan-storage-v5-schema.ts',
    'app/src/domain/adjusted-plan-storage-v6-schema.ts',
    'app/src/domain/athlete-record-display.ts',
    'app/src/domain/athlete-records.ts',
    'app/src/domain/dates.ts',
    'app/src/domain/detailed-prescription-approvals.ts',
    'app/src/domain/detailed-prescription-manifest.json',
    'app/src/domain/field-provenance.ts',
    'app/src/domain/glossary.ts',
    'app/src/domain/import/comparison-relation-read.ts',
    'app/src/domain/import/comparison-relation.ts',
    'app/src/domain/import/file-analysis-policy.ts',
    'app/src/domain/import/file-analysis.ts',
    'app/src/domain/import/file-observation.ts',
    'app/src/domain/import/file-plan-comparison.ts',
    'app/src/domain/intensity-assessment.ts',
    'app/src/domain/intensity-summary.ts',
    'app/src/domain/journal-edit-policy.ts',
    'app/src/domain/journal-schema.ts',
    'app/src/domain/numeric-input.ts',
    'app/src/domain/periodization-lineage.ts',
    'app/src/domain/plan-adaptation-context-schema.ts',
    'app/src/domain/plan-beta-schema.ts',
    'app/src/domain/plan-history-snapshot-content.ts',
    'app/src/domain/plan-method-definition.ts',
    'app/src/domain/plan-method-history.ts',
    'app/src/domain/plan-method-registry.ts',
    'app/src/domain/plan-method-resolution.ts',
    'app/src/domain/plan-session-schema.ts',
    'app/src/domain/planned-session-link.ts',
    'app/src/domain/prescription-availability-v3.ts',
    'app/src/domain/rpe-adjusted-slot-v3.ts',
    'app/src/domain/selected-adjusted-plan-content-v3.ts',
    'app/src/domain/selected-adjusted-plan-content.ts',
    'app/src/domain/selected-multi-adjusted-plan-content-v3.ts',
    'app/src/domain/session-explanation-content.ts',
    'app/src/domain/session-prescription-sequence.ts',
    'app/src/domain/source-adjustment-offer.ts',
    'app/src/domain/training-explanation-profiles.ts',
    'app/src/domain/training-explanation-receipt.ts',
    'app/src/domain/training-template-explanations.ts',
    'app/src/domain/unanchored-adjustment-offer-v3.ts',
    'impl/src/plan-generator/adaptation-transform-registry.ts',
    'impl/src/plan-generator/adaptation.ts',
    'impl/src/plan-generator/candidate-identity.ts',
    'impl/src/plan-generator/formation-types.ts',
    'impl/src/plan-generator/input-values.ts',
    'impl/src/plan-generator/main-placement-policy.ts',
    'impl/src/plan-generator/selection.ts',
    'impl/src/plan-generator/session-types.ts',
    'impl/src/plan-generator/support-only-candidate-pair.ts',
    'impl/src/plan-generator/types.ts',
    'impl/src/prescription/notation.ts',
    'impl/src/prescription/pace-sequence.ts',
    'impl/src/prescription/prescription-adjustment-v3.ts',
    'impl/src/prescription/prescription-adjustment.ts',
    'impl/src/prescription/sequence-v3-comparison.ts',
    'impl/src/prescription/sequence-v3.ts',
    'impl/src/prescription/sequence.ts',
    'impl/src/prescription/totals.ts',
    'impl/src/prescription/types.ts',
    'impl/src/rve/signal.ts',
    'impl/src/shared/assert-never.ts',
  ])
})

test('server import and validation never evaluate browser, DOM, storage or network globals', () => {
  const code = `
    for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'WebSocket']) {
      Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error('Forbidden global: ' + key) } });
    }
    const { validateAccountJournalRecord } = await import(${JSON.stringify(generatedUrl.href)});
    if (!validateAccountJournalRecord(${JSON.stringify(record())})) process.exit(1);
    if (validateAccountJournalRecord({})) process.exit(2);
  `
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' })
  assert.equal(child.status, 0, child.stderr)
  assert.equal(child.stdout, '')
})

test('canonical guard mutation is killed by the unknown-field rejection assertion', async () => {
  const codecUrl = new URL('src/domain/account/account-journal-record-schema.ts', app)
  const original = await readFile(codecUrl, 'utf8')
  const guard = 'if (input !== canonicalJson(JSON.parse(JSON.stringify(record)))) return null'
  assert.equal(original.includes(guard), true)
  const mutant = await build({
    stdin: {
      contents: original.replace(guard, ''),
      resolveDir: fileURLToPath(new URL('./', codecUrl)), loader: 'ts',
    },
    tsconfig: fileURLToPath(new URL('tsconfig.json', app)),
    bundle: true, write: false, platform: 'node', format: 'esm',
  })
  const mutated = await import(`data:text/javascript;base64,${Buffer.from(mutant.outputFiles[0].text).toString('base64')}`)
  const value = record()
  value.entry.unknown = true
  assert.equal(source.validateAccountJournalRecord(value), false)
  assert.throws(() => assert.equal(mutated.validateAccountJournalRecord(value), false), { code: 'ERR_ASSERTION' })
})
