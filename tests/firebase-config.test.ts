import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthDomain } from '../services/firebaseConfig.ts';

test('uses the same-origin Firebase Hosting domain by default', () => {
  assert.equal(resolveAuthDomain(undefined), 'neurogestor-app.web.app');
});

test('keeps an explicitly configured auth domain', () => {
  assert.equal(resolveAuthDomain('login.neurogestor.com.br'), 'login.neurogestor.com.br');
});
