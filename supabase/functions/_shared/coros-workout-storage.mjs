import { withPayloadDigests } from './coros.mjs';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);

// Capture one generation before asynchronous payload work. Never re-resolve a
// failed old job to the newly connected account. DB rechecks it under its lock.
export async function prepareCorosWorkoutStorage(items, resolveConnection, digest = withPayloadDigests) {
  const bindings = new Map();
  for (const item of items) {
    if (bindings.has(item.providerUserId)) continue;
    const link = await resolveConnection(item.providerUserId);
    if (!link || link.connection_status !== 'ACTIVE' || !uuid(link.id)
      || !uuid(link.user_id) || !uuid(link.connection_epoch)) throw new Error('WORKOUT_CONNECTION_UNAVAILABLE');
    bindings.set(item.providerUserId, { connectionId: link.id, ownerId: link.user_id, connectionEpoch: link.connection_epoch });
  }
  return (await digest(items)).map(item => ({ ...item, ...bindings.get(item.providerUserId) }));
}

export function corosWorkoutConnectionResolver(url, serviceKey, transport = fetch) {
  return async providerUserId => {
    const endpoint = new URL('/rest/v1/external_provider_connections', url);
    endpoint.search = new URLSearchParams({ select: 'id,user_id,connection_epoch,connection_status',
      provider: 'eq.COROS', provider_user_id: `eq.${providerUserId}`, connection_status: 'eq.ACTIVE', limit: '2' }).toString();
    const response = await transport(endpoint, { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
      cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error('WORKOUT_CONNECTION_UNAVAILABLE');
    const rows = await response.json();
    return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  };
}
