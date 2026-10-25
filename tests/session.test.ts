import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthenticatedSessionUser } from '../services/session.ts';

test('legacy profile receives current Firebase uid without losing stored fields', () => {
  const legacyProfile = {
    email: 'rafaelleaobh@gmail.com',
    name: 'Rafael',
    status: 'APPROVED',
    role: 'owner',
    team_id: 'camarinha'
  };

  const result = buildAuthenticatedSessionUser(legacyProfile as any, {
    uid: 'firebase-current-uid',
    email: 'RafaelLeaoBH@gmail.com'
  });

  assert.equal(result.auth_uid, 'firebase-current-uid');
  assert.equal(result.email, 'rafaelleaobh@gmail.com');
  assert.equal(result.status, 'APPROVED');
  assert.equal(result.role, 'owner');
  assert.equal(result.team_id, 'camarinha');
});

test('falls back to profile email when Firebase identity email is absent', () => {
  const result = buildAuthenticatedSessionUser({
    email: 'User@Example.com',
    status: 'APPROVED',
    role: 'user'
  } as any, { uid: 'uid-current', email: null });

  assert.equal(result.email, 'user@example.com');
  assert.equal(result.auth_uid, 'uid-current');
});

test('rejects a profile already linked to a different Firebase uid', () => {
  assert.throws(
    () => buildAuthenticatedSessionUser({
      email: 'user@example.com',
      auth_uid: 'uid-original',
      status: 'APPROVED',
      role: 'user'
    } as any, { uid: 'uid-different', email: 'user@example.com' }),
    /identidade autenticada não corresponde ao perfil/i
  );
});

test('preserves an existing matching Firebase uid', () => {
  const result = buildAuthenticatedSessionUser({
    email: 'user@example.com',
    auth_uid: 'uid-current',
    status: 'APPROVED',
    role: 'user'
  } as any, { uid: 'uid-current', email: 'user@example.com' });

  assert.equal(result.auth_uid, 'uid-current');
});
