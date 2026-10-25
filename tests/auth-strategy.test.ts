import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRedirectPersistencePreference,
  shouldFallbackToRedirect,
  shouldUseRedirectLogin
} from '../services/authStrategy.ts';

test('uses redirect login on mobile browsers', () => {
  assert.equal(shouldUseRedirectLogin('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5), true);
  assert.equal(shouldUseRedirectLogin('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 5), true);
});

test('uses redirect login on iPad in desktop mode', () => {
  assert.equal(shouldUseRedirectLogin('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1.15', 5), true);
});

test('keeps popup login on desktop browsers', () => {
  assert.equal(shouldUseRedirectLogin('Mozilla/5.0 (X11; Linux x86_64) Chrome/140 Safari/537.36', 0), false);
  assert.equal(shouldUseRedirectLogin('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1.15', 0), false);
});

test('preserves the remember-me choice across redirect navigation', () => {
  assert.equal(getRedirectPersistencePreference('local'), true);
  assert.equal(getRedirectPersistencePreference('session'), false);
  assert.equal(getRedirectPersistencePreference(null), null);
  assert.equal(getRedirectPersistencePreference('invalid'), null);
});

test('falls back to redirect when popup is blocked or unsupported', () => {
  assert.equal(shouldFallbackToRedirect('auth/popup-blocked'), true);
  assert.equal(shouldFallbackToRedirect('auth/operation-not-supported-in-this-environment'), true);
  assert.equal(shouldFallbackToRedirect('auth/network-request-failed'), false);
});
