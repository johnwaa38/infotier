import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSentinel } from './sentinel';

const healthy = { database: 'connected' as const, diditConfigured: true, adminPasswordConfigured: true, jwtSecretConfigured: true, ephemeralEvidenceStorage: false };

test('reports healthy when all required controls are present', () => {
  assert.equal(evaluateSentinel(healthy).state, 'healthy');
});

test('reports degraded for demo-only ephemeral evidence storage', () => {
  const result = evaluateSentinel({ ...healthy, ephemeralEvidenceStorage: true });
  assert.equal(result.state, 'degraded');
  assert.equal(result.issues[0]?.code, 'ephemeral_evidence');
});

test('reports action required when a critical dependency fails', () => {
  const result = evaluateSentinel({ ...healthy, database: 'unavailable' });
  assert.equal(result.state, 'action_required');
  assert.equal(result.issues[0]?.severity, 'critical');
});
