/** Only factual, bounded source intervals establish separate sessions. Timer or
 * moving time alone is not a wall-clock bound. No fuzzy matching or aggregation. */
function interval(observation, source) {
  if (!observation || source?.manual || source?.parent?.isParent || source?.parent?.parentSummaryId) return null;
  const start = Date.parse(observation.startedAt);
  const seconds = observation.durationMeaning === 'ELAPSED' ? observation.durationSeconds
    : source?.monitoringPeriod?.basis === 'GARMIN_MONITORING_PERIOD' ? source.monitoringPeriod.seconds : null;
  if (!Number.isFinite(start) || typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  const end = start + seconds * 1000;
  return Number.isFinite(end) && end <= 8640000000000000 ? [start, end] : null;
}

export async function allCandidatesDistinct(row, observation, source, candidates, decode, sourceContext) {
  if (!Array.isArray(candidates) || candidates.length >= 65) return false;
  if (!candidates.length) return true;
  const current = interval(observation, source);
  if (!current) return false;
  for (const candidate of candidates) {
    const other = candidate.source;
    // Unlinked/manual/file journals, deletion markers and old epochs require review.
    if (!candidate.active || !other || other.user_id !== row.user_id || other.epoch !== row.epoch
      || other.connection_id !== row.connection_id || other.state !== 'CONFIRMED'
      || other.document_id !== candidate.documentId || !candidate.documentRevision
      || other.activity_hash === row.activity_hash) return false;
    const previous = await decode(other), previousSource = await sourceContext(other);
    if (!previous || previous.sourceId === observation.sourceId) return false;
    const earlier = interval(previous, previousSource);
    if (!earlier || !(current[1] <= earlier[0] || earlier[1] <= current[0])) return false;
  }
  return true;
}
