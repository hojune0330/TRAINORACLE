// Server-side primitive only: no key persistence, secret injection or HTTP endpoint.
const MAX_CIPHERTEXT_BYTES = 1_048_576;
const MAX_PLAINTEXT_BYTES = MAX_CIPHERTEXT_BYTES - 16;
const encoder = new TextEncoder();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const base64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

function invalid() { return new Error('ACCOUNT_JOURNAL_CRYPTO_INVALID'); }

function contextBytes(context, keyId) {
  if (!context || typeof context.ownerId !== 'string' || typeof context.documentId !== 'string'
    || !uuid.test(context.ownerId) || !uuid.test(context.documentId)
    || typeof keyId !== 'string' || keyId.trim().length < 1 || keyId.length > 80) throw invalid();
  return encoder.encode(JSON.stringify(['trainoracle.account-journal', 1,
    context.ownerId.toLowerCase(), context.documentId.toLowerCase(), keyId]));
}

function encode(bytes) {
  // Chunking avoids argument-stack limits for long diary text.
  let result = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(result);
}

function decode(value, min, max) {
  if (typeof value !== 'string' || value.length > 4 * Math.ceil(max / 3)
    || !base64.test(value)) throw invalid();
  const binary = atob(value);
  if (binary.length < min || binary.length > max) throw invalid();
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (encode(bytes) !== value) throw invalid();
  return bytes;
}

function validateKey(key, usage) {
  if (!key || key.type !== 'secret' || key.extractable !== false
    || key.algorithm?.name !== 'AES-GCM' || key.algorithm?.length !== 256
    || !key.usages?.includes(usage)) throw invalid();
}

/** The caller supplies a non-extractable server key, never a user's password/token. */
export async function encryptAccountJournalDocument(plaintext, context, material) {
  try {
    if (typeof plaintext !== 'string' || plaintext.length > MAX_PLAINTEXT_BYTES) throw invalid();
    const bytes = encoder.encode(plaintext);
    if (bytes.length > MAX_PLAINTEXT_BYTES
      || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== plaintext) throw invalid();
    validateKey(material?.key, 'encrypt');
    const additionalData = contextBytes(context, material.keyId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
      additionalData, tagLength: 128 }, material.key, bytes);
    return Object.freeze({ version: 1, algorithm: 'AES-GCM', keyId: material.keyId,
      iv: encode(iv), ciphertext: encode(new Uint8Array(encrypted)) });
  } catch {
    // Never attach plaintext, keys, payloads or provider errors to logs/error messages.
    throw invalid();
  }
}

export async function decryptAccountJournalDocument(payload, context, material) {
  try {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || Object.keys(payload).sort().join(',') !== 'algorithm,ciphertext,iv,keyId,version'
      || payload.version !== 1 || payload.algorithm !== 'AES-GCM'
      || payload.keyId !== material?.keyId) throw invalid();
    validateKey(material.key, 'decrypt');
    const additionalData = contextBytes(context, payload.keyId);
    const iv = decode(payload.iv, 12, 12);
    const ciphertext = decode(payload.ciphertext, 16, MAX_CIPHERTEXT_BYTES);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv,
      additionalData, tagLength: 128 }, material.key, ciphertext);
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(plaintext);
  } catch {
    throw invalid();
  }
}
