import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptAccountJournalDocument as encrypt, decryptAccountJournalDocument as decrypt }
  from '../functions/_shared/account-journal-crypto.mjs';

const context = { ownerId: 'a1111111-1111-4111-8111-111111111111',
  documentId: 'c3333333-3333-4333-8333-333333333333' };
let material, second;
before(async () => {
  material = { keyId: 'synthetic-v1',
    key: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) };
  second = { keyId: 'synthetic-v2',
    key: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) };
});

for (const text of ['', 'synthetic journal', '\ufeffabc', '\ud55c\uae00 \uc77c\uc9c0\n\ud83c\udfc3', 'x'.repeat(100_000)]) {
  test(`round trip preserves synthetic UTF-8 content (${text.length} code units)`, async () => {
    const payload = await encrypt(text, context, material);
    assert.equal(await decrypt(payload, context, material), text);
    assert.equal(Object.keys(payload).length, 5);
    assert.equal(payload.key, undefined);
    assert.equal(payload.plaintext, undefined);
  });
}
test('random IV changes ciphertext for repeated identical input', async () => {
  const a = await encrypt('same', context, material);
  const b = await encrypt('same', context, material);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
});
test('cannot copy ciphertext to another owner, document or key version', async () => {
  const payload = await encrypt('synthetic-private', context, material);
  for (const changed of [
    { ...context, ownerId: 'b2222222-2222-4222-8222-222222222222' },
    { ...context, documentId: 'd4444444-4444-4444-8444-444444444444' },
  ]) await assert.rejects(decrypt(payload, changed, material), { message: 'ACCOUNT_JOURNAL_CRYPTO_INVALID' });
  await assert.rejects(decrypt({ ...payload, keyId: 'renamed' }, context,
    { ...material, keyId: 'renamed' }), { message: 'ACCOUNT_JOURNAL_CRYPTO_INVALID' });
  await assert.rejects(decrypt(payload, context, { ...second, keyId: material.keyId }));
});
test('retained old key reads old version; new key cannot silently replace it', async () => {
  const old = await encrypt('old', context, material);
  const current = await encrypt('new', context, second);
  assert.equal(await decrypt(old, context, material), 'old');
  assert.equal(await decrypt(current, context, second), 'new');
  await assert.rejects(decrypt(old, context, second));
});
test('tampered envelopes and plaintext extras fail without exposing source text', async () => {
  const original = await encrypt('synthetic-private', context, material);
  for (const patch of [{ version: 2 }, { algorithm: 'AES-CBC' }, { iv: 'bad' },
    { ciphertext: 'AAAA' }, { ciphertext: '!'.repeat(24) }, { plaintext: 'synthetic-private' },
    { ciphertext: (original.ciphertext[0] === 'A' ? 'B' : 'A') + original.ciphertext.slice(1) }]) {
    await assert.rejects(decrypt({ ...original, ...patch }, context, material),
      error => error.message === 'ACCOUNT_JOURNAL_CRYPTO_INVALID' && !error.cause);
  }
});
test('rejects wrong key type, extractable keys, invalid context and excessive UTF-8 bytes', async () => {
  const extractable = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  await assert.rejects(encrypt('private', context, { ...material, key: extractable }));
  await assert.rejects(encrypt('private', context, { ...material, key: null }));
  await assert.rejects(encrypt('private', { ...context, ownerId: 'not-an-id' }, material));
  await assert.rejects(encrypt('\ud55c'.repeat(400_000), context, material));
  await assert.rejects(encrypt('private', context, { ...material, keyId: '' }));
  await assert.rejects(encrypt('private', context, { ...material, keyId: '   ' }));
  await assert.rejects(encrypt('\ud800', context, material));
});
