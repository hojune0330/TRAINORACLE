const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
const key = value => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const exact = (value, names) => typeof value === 'object' && value !== null && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
export const DELETION_TIMEOUT_MS = 8000;
// Sequential worst case: one claim + three rows * (send + complete + retry).
// 80s stays below the 120s SQL lease and free Edge Function 150s wall-clock.
export const DELETION_BATCH_SIZE = 3;

export function deletionEndpoint(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port
      || url.pathname !== '/api/lounge/internal/identity-deletion'
      || /(?:^localhost$|\.localhost\.?$|\.local\.?$|^\[.*\]$|^\d+(?:\.\d+){3}$)/iu.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

async function bounded(operation) {
  const controller = new AbortController();
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(Error('DELETION_UNAVAILABLE')); }, DELETION_TIMEOUT_MS);
  });
  try { return await Promise.race([operation(controller.signal), expired]); }
  finally { clearTimeout(timer); controller.abort(); }
}

export function createLoungeDeletionRepository(client) {
  const call = async (name, input, signal) => {
    const { data, error } = await client.rpc(name, input).abortSignal(signal);
    if (error) throw Error('DELETION_UNAVAILABLE');
    return data;
  };
  return {
    claim: signal => call('claim_lounge_identity_deletions', { limit_input: DELETION_BATCH_SIZE }, signal),
    complete: (row, signal) => call('complete_lounge_identity_deletion', { request_id_input: row.requestId, lease_id_input: row.leaseId }, signal),
    retry: (row, signal) => call('retry_lounge_identity_deletion', { request_id_input: row.requestId, lease_id_input: row.leaseId }, signal),
  };
}

export function createLoungeDeletionWorker({ repository, endpoint, deletionKey, fetchImpl = fetch }) {
  const target = deletionEndpoint(endpoint);
  if (!target || !key(deletionKey)) throw Error('DELETION_CONFIGURATION_UNAVAILABLE');
  return async () => {
    const rows = await bounded(signal => repository.claim(signal));
    if (!Array.isArray(rows) || rows.length > DELETION_BATCH_SIZE || rows.some(row => !exact(row, ['version','requestId','subject','leaseId'])
      || row.version !== 1 || !uuid(row.requestId) || !uuid(row.subject) || !uuid(row.leaseId))) throw Error('DELETION_UNAVAILABLE');
    const result = { version: 1, attempted: rows.length, completed: 0, pending: 0 };
    for (const row of rows) {
      try {
        const acknowledged = await bounded(async signal => {
          const response = await fetchImpl(target, { method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store', signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deletionKey}` },
            body: JSON.stringify({ version: 1, requestId: row.requestId, issuer: 'trainoracle', subject: row.subject }) });
          if (!response.ok) throw Error('DELETION_UNAVAILABLE');
          const responseBody = await response.json();
          return exact(responseBody, ['version','requestId','status']) && responseBody.version === 1
            && responseBody.requestId === row.requestId && responseBody.status === 'completed';
        });
        if (!acknowledged || await bounded(signal => repository.complete(row, signal)) !== true) throw Error('DELETION_UNAVAILABLE');
        result.completed++;
      } catch {
        result.pending++;
        // Lost ACK/retry failure never drops a row; its bounded lease expires.
        try { await bounded(signal => repository.retry(row, signal)); } catch { /* Keep lease for next operator run. */ }
      }
    }
    return result; // Counts only; never log or return subjects, keys or request bodies.
  };
}

export function createLoungeDeletionHandler({ invokeKey, worker }) {
  return async request => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
    const fail = (code, status) => new Response(JSON.stringify({ code }), { status, headers });
    // Private operator endpoint: no browser CORS path and no ordinary user JWT.
    if (!key(invokeKey) || request.headers.has('origin') || request.headers.get('authorization') !== `Bearer ${invokeKey}`) return fail('FORBIDDEN', 403);
    if (request.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 405);
    try {
      const body = await request.text();
      if (body !== '{}' && body !== '') return fail('INVALID_REQUEST', 400);
      return new Response(JSON.stringify(await worker()), { status: 200, headers });
    } catch { return fail('DELETION_UNAVAILABLE', 503); }
  };
}
