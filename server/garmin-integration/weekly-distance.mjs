import {decryptAccountJournalDocument} from '../../supabase/functions/_shared/account-journal-crypto.mjs';
import {validateAccountJournalDocument} from '../../supabase/functions/_shared/account-journal-handler.mjs';
import {fail} from './primitives.mjs';

const day = 86400000;
const sports = ['RUNNING','WALKING','CYCLING','OTHER'];
const dateAt = milliseconds => new Date(milliseconds).toISOString().slice(0,10);

export function garminWeeklyPeriods(today) {
  if (typeof today !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(today)) fail(422,'INVALID_INPUT');
  const asOf = Date.parse(today + 'T00:00:00Z');
  if (!Number.isFinite(asOf) || dateAt(asOf) !== today) fail(422,'INVALID_INPUT');
  const monday = asOf - (new Date(asOf).getUTCDay() + 6) % 7 * day;
  const period = (start,end) => ({startDate:dateAt(start),endDate:dateAt(end),groups:[],includedEntryIds:[],excludedCount:0});
  return {current:period(monday,asOf),previous:period(monday-7*day,asOf-7*day)};
}

async function verifiedDistance(row, ownerId, decode, sourceContext, journalKeyring) {
  if (!row.journal || !row.encrypted_context || !row.encrypted_observation || row.user_id !== ownerId) return null;
  const source = await sourceContext(row);
  const clock = source?.clock;
  if (source?.manual !== false || source.parent?.isParent !== false || source.parent.parentSummaryId !== null
    || !source.summaryId || clock?.basis !== 'DEVICE_OFFSET' || clock.localDate !== row.date
    || !Number.isInteger(clock.offsetSeconds) || Math.abs(clock.offsetSeconds) >= 86400) return null;
  const observation = await decode(row);
  if (observation?.provider !== 'GARMIN' || !sports.includes(observation.sport) || !observation.sourceId?.startsWith('activity:')
    || !Number.isFinite(observation.distanceMeters) || observation.distanceMeters < 0) return null;
  const localTime = Date.parse(observation.startedAt) + clock.offsetSeconds * 1000;
  if (!Number.isFinite(localTime) || dateAt(localTime) !== row.date) return null;

  const key = journalKeyring?.get(row.journal.keyId);
  if (!key) fail(503,'ENCRYPTED_DATA_UNAVAILABLE');
  let document;
  try {
    document = JSON.parse(await decryptAccountJournalDocument(row.journal,{ownerId,documentId:row.document_id},key));
  } catch { fail(503,'ENCRYPTED_DATA_UNAVAILABLE'); }
  const entry = document?.entry;
  if (!validateAccountJournalDocument(document) || document.state !== 'FINALIZED' || document.kind !== 'JOURNAL'
    || entry.kind !== 'post-session' || entry.id !== row.entry_id || entry.date !== row.date
    || entry.distanceKm !== String(observation.distanceMeters/1000)
    || entry.fieldProvenance?.distanceKm?.derivationRuleId !== 'import:GARMIN:provider-v1') return null;
  return {entryId:entry.id,sourceId:observation.sourceId,summaryId:source.summaryId,sport:observation.sport,meters:observation.distanceMeters};
}

/** Authenticated, current-revision Garmin subtotal. Nothing from this read enters the journal or an AI input. */
export async function readGarminWeeklyDistance(today, ownerId, call, decode, sourceContext, journalKeyring) {
  const periods = garminWeeklyPeriods(today);
  const query = {action:'weeklySnapshot',today};
  const {rows,snapshot} = await call(query);
  if (!Array.isArray(rows) || rows.length>128 || !/^[0-9a-f]{64}$/.test(snapshot)) fail(503,'OPERATIONS_PENDING');
  const candidates = [], seen = new Set(), conflicts = new Set();
  for (const row of rows) {
    const period = Object.values(periods).find(value => row.date >= value.startDate && row.date <= value.endDate);
    if (!period) fail(503,'OPERATIONS_PENDING');
    period.excludedCount++;
    const fact = await verifiedDistance(row,ownerId,decode,sourceContext,journalKeyring);
    if (!fact) continue;
    const keys = ['activity:'+row.activity_hash,'source:'+fact.sourceId,'summary:'+fact.summaryId,'entry:'+fact.entryId];
    for (const key of keys) { if (seen.has(key)) conflicts.add(key); seen.add(key); }
    candidates.push({period,fact,keys});
  }
  for (const {period,fact,keys} of candidates) {
    // Duplicate delivery is already idempotent in storage. Conflicting links cannot select a winner by row order.
    if (keys.some(key => conflicts.has(key))) continue;
    let group = period.groups.find(value => value.sport === fact.sport);
    if (!group) { group={sport:fact.sport,distanceMeters:0,includedCount:0}; period.groups.push(group); }
    group.distanceMeters+=fact.meters;
    if (!Number.isFinite(group.distanceMeters)) fail(503,'OPERATIONS_PENDING');
    group.includedCount++; period.includedEntryIds.push(fact.entryId); period.excludedCount--;
  }
  for (const period of Object.values(periods)) period.groups.sort((a,b)=>sports.indexOf(a.sport)-sports.indexOf(b.sport));
  const result = await call({...query,expectedSnapshot:snapshot});
  if (result.kind !== 'verified') fail(409,'SOURCE_CHANGED');
  return periods;
}
