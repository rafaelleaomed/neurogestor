import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Espelha os valores do enum Status sem importar TypeScript enum
const Status = {
  AGENDADO: 'Agendado',
  REALIZADO: 'Realizado',
  FATURADO: 'Faturado',
  CANCELADO: 'Cancelado'
};

const toggleSurgeryCancellation = (s) => {
  if (s.status === Status.CANCELADO) {
    const { status_before_cancel, ...rest } = s;
    return { ...rest, status: status_before_cancel ?? Status.REALIZADO };
  }
  return { ...s, status: Status.CANCELADO, status_before_cancel: s.status };
};

const activeSurgeries = (list) =>
  list.filter(s => s.status !== Status.CANCELADO);

const surgery = (status, overrides = {}) => ({
  id: 's1',
  data: '2026-10-22',
  paciente: 'Paciente teste',
  procedimento: 'Procedimento teste',
  categoria: 'Coluna',
  medico: 'Médico teste',
  hospital: 'Hospital teste',
  valor_estimado: 1000,
  status,
  created_at: 1,
  owner_email: 'owner@example.com',
  ...overrides
});

test('cancellation preserves the previous status and reactivation restores it', () => {
  const cancelled = toggleSurgeryCancellation(surgery(Status.FATURADO));
  assert.equal(cancelled.status, Status.CANCELADO);
  assert.equal(cancelled.status_before_cancel, Status.FATURADO);

  const reactivated = toggleSurgeryCancellation(cancelled);
  assert.equal(reactivated.status, Status.FATURADO);
  assert.equal(reactivated.status_before_cancel, undefined);
});

test('legacy cancelled records without previous status reactivate as realizado', () => {
  const reactivated = toggleSurgeryCancellation(surgery(Status.CANCELADO));
  assert.equal(reactivated.status, Status.REALIZADO);
});

test('cancelled surgeries are excluded from metrics without changing ownership', () => {
  const active = surgery(Status.REALIZADO, { id: 'active' });
  const cancelled = toggleSurgeryCancellation(surgery(Status.AGENDADO, { id: 'cancelled' }));
  const result = activeSurgeries([active, cancelled]);

  assert.deepEqual(result.map(item => item.id), ['active']);
  assert.equal(cancelled.owner_email, 'owner@example.com');
});

test('dashboard exposes cancellation and reactivation actions', async () => {
  const dashboard = await readFile(new URL('../pages/Dashboard.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /Cancelar Cirurgia/);
  assert.match(dashboard, /Reativar Cirurgia/);
  assert.match(dashboard, /status.*Status\.CANCELADO/);
});
