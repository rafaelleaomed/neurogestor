import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribeWithReady } from '../services/dataSubscription.ts';

test('initial load waits until the first realtime value is applied', async () => {
  let emit: ((value: string[]) => void) | undefined;
  const applied: string[][] = [];
  let readyResolved = false;

  const subscription = subscribeWithReady<string[]>(
    (next) => {
      emit = next;
      return () => {};
    },
    (value) => applied.push(value),
    () => {}
  );

  subscription.ready.then(() => { readyResolved = true; });
  await Promise.resolve();
  assert.equal(readyResolved, false);

  emit?.(['cirurgia-1']);
  await subscription.ready;

  assert.equal(readyResolved, true);
  assert.deepEqual(applied, [['cirurgia-1']]);
});

test('initial load also releases when the realtime source fails', async () => {
  let fail: ((error: unknown) => void) | undefined;
  const errors: unknown[] = [];

  const subscription = subscribeWithReady<string[]>(
    (_next, error) => {
      fail = error;
      return () => {};
    },
    () => {},
    (error) => errors.push(error)
  );

  fail?.(new Error('offline'));
  await subscription.ready;
  assert.equal(errors.length, 1);
});

test('initial load releases after the safety timeout', async () => {
  const subscription = subscribeWithReady<string[]>(
    () => () => {},
    () => {},
    () => {},
    5
  );

  await subscription.ready;
});
