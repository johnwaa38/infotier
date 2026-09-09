import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { sortKeys, verifyDiditWebhook } from './didit-signature';

const secret = 'test-secret';
const now = 1_800_000_000;
const body = { webhook_type: 'status.updated', status: 'Approved', session_id: 'session-1', event_id: 'event-1' };
const raw = Buffer.from(JSON.stringify(body));
const hmac = (value: Buffer | string) => createHmac('sha256', secret).update(value).digest('hex');

test('accepts the raw-body signature', () => {
  assert.equal(verifyDiditWebhook(raw, { timestamp: String(now), signatureRaw: hmac(raw) }, secret, now).event_id, 'event-1');
});

test('accepts the canonical V2 signature', () => {
  const signatureV2 = hmac(JSON.stringify(sortKeys(body)));
  assert.equal(verifyDiditWebhook(raw, { timestamp: String(now), signatureV2 }, secret, now).status, 'Approved');
});

test('builds the simple signature with the timestamp header', () => {
  const timestamp = String(now);
  const signatureSimple = hmac(`${timestamp}:session-1:Approved:status.updated`);
  assert.equal(verifyDiditWebhook(raw, { timestamp, signatureSimple }, secret, now).session_id, 'session-1');
});

test('rejects stale and invalid signatures', () => {
  assert.throws(() => verifyDiditWebhook(raw, { timestamp: String(now - 301), signatureRaw: hmac(raw) }, secret, now), /timestamp/);
  assert.throws(() => verifyDiditWebhook(raw, { timestamp: String(now), signatureRaw: 'bad' }, secret, now), /signature/);
});
