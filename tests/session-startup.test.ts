import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeAuthenticatedSession } from '../services/sessionStartup.ts';

test('dashboard user is exposed only after storage finishes its initial load', async () => {
  const order: string[] = [];
  const user = { email: 'user@example.com' } as any;

  await initializeAuthenticatedSession(user, {
    setSession: () => order.push('session'),
    initStorage: async () => {
      order.push('storage:start');
      await Promise.resolve();
      order.push('storage:ready');
    },
    setUser: () => order.push('dashboard'),
    isCurrent: () => true
  });

  assert.deepEqual(order, ['session', 'storage:start', 'storage:ready', 'dashboard']);
});

test('stale authentication startup cannot overwrite the active dashboard user', async () => {
  const order: string[] = [];
  const user = { email: 'old@example.com' } as any;

  await initializeAuthenticatedSession(user, {
    setSession: () => order.push('session'),
    initStorage: async () => { order.push('storage'); },
    setUser: () => order.push('stale-dashboard'),
    isCurrent: () => false
  });

  assert.deepEqual(order, ['session', 'storage']);
});
