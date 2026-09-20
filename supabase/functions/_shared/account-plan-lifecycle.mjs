// Internal, non-wire foundation only. No handler imports or persistence side effects.
export const PLAN_RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_REVISION = Number.MAX_SAFE_INTEGER - 1;
const requestKeys = ['version', 'action', 'ownerId', 'planId', 'expectedRevision', 'operationId'];
const planKeys = ['planId', 'status', 'deletedAt', 'restoredAt'];
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(v);
const hash = v => typeof v === 'string' && /^sha256:[a-f0-9]{64}$/u.test(v);
const revision = v => Number.isSafeInteger(v) && v >= 1 && v <= MAX_REVISION;
const reject = code => ({ kind: 'rejected', code });
const clone = value => JSON.parse(JSON.stringify(value));

// Reject extra keys, symbols, accessors and class instances, not just JSON fields.
function exact(value, names) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === names.length && names.every(name => {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, 'value');
  });
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function validRequest(value, actions) {
  return exact(value, requestKeys) && value.version === 1 && actions.includes(value.action)
    && uuid(value.ownerId) && hash(value.planId) && uuid(value.operationId)
    && revision(value.expectedRevision) && value.expectedRevision < MAX_REVISION;
}

function validPlan(value, asOf) {
  if (!exact(value, planKeys) || !hash(value.planId)) return false;
  const deleted = value.deletedAt, restored = value.restoredAt;
  if (deleted !== null && (!timestamp(deleted) || deleted > asOf)) return false;
  if (restored !== null && (!timestamp(restored) || restored > asOf)) return false;
  if (value.status === 'AVAILABLE') return deleted === null && restored === null;
  if (value.status === 'DELETED') return deleted !== null && restored === null;
  return value.status === 'ARCHIVED' && (deleted === null ? restored === null
    : restored !== null && restored >= deleted
      && Date.parse(restored) - Date.parse(deleted) < PLAN_RESTORE_WINDOW_MS);
}

function validState(value, now) {
  if (!exact(value, ['version', 'ownerId', 'revision', 'updatedAt', 'currentPlanId', 'plans'])
    || value.version !== 1 || !uuid(value.ownerId) || !revision(value.revision)
    || !timestamp(value.updatedAt) || value.updatedAt > now
    || (value.currentPlanId !== null && !hash(value.currentPlanId))
    || !Array.isArray(value.plans) || Object.getPrototypeOf(value.plans) !== Array.prototype
    || value.plans.length > 100 || Reflect.ownKeys(value.plans).length !== value.plans.length + 1) return false;
  const ids = new Set();
  for (let i = 0; i < value.plans.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value.plans, String(i));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return false;
    const plan = descriptor.value;
    if (!validPlan(plan, value.updatedAt) || ids.has(plan.planId)) return false;
    ids.add(plan.planId);
  }
  return value.currentPlanId === null
    || value.plans.some(plan => plan.planId === value.currentPlanId && plan.status === 'AVAILABLE');
}

function validReceipt(value, state) {
  if (!exact(value, ['version', 'request', 'revision', 'serverTime', 'lifecycle', 'currentPlanId'])
    || value.version !== 1 || !validRequest(value.request, ['DELETE', 'RESTORE'])
    || value.request.ownerId !== state.ownerId || !revision(value.revision)
    || value.revision !== value.request.expectedRevision + 1 || value.revision > state.revision
    || !timestamp(value.serverTime) || value.serverTime > state.updatedAt
    || !validPlan(value.lifecycle, value.serverTime) || value.lifecycle.planId !== value.request.planId
    || (value.currentPlanId !== null && !hash(value.currentPlanId))
    || value.currentPlanId === value.request.planId) return false;
  if (value.revision === state.revision) {
    const target = state.plans.find(plan => plan.planId === value.request.planId);
    if (!target || !planKeys.every(key => target[key] === value.lifecycle[key])
      || value.currentPlanId !== state.currentPlanId || value.serverTime !== state.updatedAt) return false;
  }
  return value.request.action === 'DELETE'
    ? value.lifecycle.status === 'DELETED' && value.lifecycle.deletedAt === value.serverTime
    : value.lifecycle.status === 'ARCHIVED' && value.lifecycle.deletedAt !== null
      && value.lifecycle.restoredAt === value.serverTime;
}

function validateContext(input, actions, withReceipt) {
  const fields = ['authenticatedOwnerId', 'serverNow', 'state', 'request'];
  if (withReceipt) fields.push('priorReceipt');
  if (!exact(input, fields) || !validRequest(input.request, actions)) return reject('INVALID_REQUEST');
  if (!uuid(input.authenticatedOwnerId)) return reject('AUTH_REQUIRED');
  if (input.request.ownerId !== input.authenticatedOwnerId) return reject('ACCESS_DENIED');
  if (!timestamp(input.serverNow)) return reject('INVALID_SERVER_TIME');
  if (!validState(input.state, input.serverNow)) return reject('INVALID_SERVER_STATE');
  if (input.state.ownerId !== input.authenticatedOwnerId) return reject('ACCESS_DENIED');
  return null;
}

/**
 * @param {unknown} input
 * Caller supplies verified authentication, server clock, locked owner-scoped state,
 * and the authoritative receipt lookup (explicit null only when absent). Never
 * accept these from the request body. Owner-neutral hashes confer no authority.
 *
 * A proposal is NOT a commit: the DB transaction must check consent/auth/CAS,
 * write lifecycle + pointer + revision + receipt together, and reject old writers.
 * Replay returns the historical receipt only, never a state to apply again.
 */
export function proposeAccountPlanLifecycleTransition(input) {
  try {
    const invalid = validateContext(input, ['DELETE', 'RESTORE'], true);
    if (invalid) return invalid;
    const { request, state, serverNow, priorReceipt } = input;
    // Replay precedes CAS/expiry: a lost response does not reopen a transition.
    if (priorReceipt !== null) {
      if (!validReceipt(priorReceipt, state)) return reject('INVALID_RECEIPT');
      if (!requestKeys.every(key => request[key] === priorReceipt.request[key])) return reject('OPERATION_REUSED');
      return { kind: 'replay', receipt: clone(priorReceipt) };
    }
    if (request.expectedRevision !== state.revision) return reject('STALE_REVISION');
    const target = state.plans.find(plan => plan.planId === request.planId);
    if (!target) return reject('PLAN_NOT_FOUND');
    if (request.action === 'DELETE' && target.status === 'DELETED') return reject('PLAN_DELETED');
    if (request.action === 'RESTORE') {
      if (target.status !== 'DELETED') return reject('PLAN_NOT_DELETED');
      if (Date.parse(serverNow) - Date.parse(target.deletedAt) >= PLAN_RESTORE_WINDOW_MS) return reject('RESTORE_EXPIRED');
    }
    const lifecycle = request.action === 'DELETE'
      ? { planId: target.planId, status: 'DELETED', deletedAt: serverNow, restoredAt: null }
      : { planId: target.planId, status: 'ARCHIVED', deletedAt: target.deletedAt, restoredAt: serverNow };
    const currentPlanId = request.action === 'DELETE' && state.currentPlanId === target.planId
      ? null : state.currentPlanId;
    const nextState = { ...state, revision: state.revision + 1, updatedAt: serverNow, currentPlanId,
      plans: state.plans.map(plan => ({ ...(plan.planId === target.planId ? lifecycle : plan) })) };
    const receipt = { version: 1, request: clone(request), revision: nextState.revision,
      serverTime: serverNow, lifecycle: { ...lifecycle }, currentPlanId };
    return { kind: 'proposed', nextState, receipt };
  } catch { return reject('INVALID_INPUT'); }
}

/**
 * @param {unknown} input
 * Necessary freshness/lifecycle check, NOT permission to execute or persist.
 * Integrate inside the same DB transaction as SELECT/PROGRESS and repeat CAS.
 * Archived entries remain immutable under existing collection rules; restoring
 * one never enables direct SELECT. A separate reviewed reselection path is pending.
 */
export function validateAccountPlanLifecycleWrite(input) {
  try {
    const invalid = validateContext(input, ['PROGRESS', 'SELECT'], false);
    if (invalid) return invalid;
    const { state, request } = input;
    if (state.revision !== request.expectedRevision) return reject('STALE_REVISION');
    const target = state.plans.find(plan => plan.planId === request.planId);
    if (!target) return reject('PLAN_NOT_FOUND');
    if (target.status === 'DELETED') return reject('PLAN_DELETED');
    if (target.status === 'ARCHIVED') return reject('PLAN_ARCHIVED');
    return { kind: 'eligible', request: clone(request) };
  } catch { return reject('INVALID_INPUT'); }
}
