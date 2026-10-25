import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSurgeryExportRows } from '../services/spreadsheetExport.ts';
import { Category, Status, type Surgery } from '../types.ts';

const active = {
  id: 'active', data: '2026-10-01', paciente: 'Paciente ativo', procedimento: 'Teste',
  categoria: Category.COLUNA, medico: 'Médico', hospital: 'Hospital', valor_estimado: 1000,
  status: Status.REALIZADO, created_at: 1
} satisfies Surgery;

const cancelled = {
  ...active, id: 'cancelled', data: '2026-10-02', paciente: 'Paciente cancelado',
  valor_estimado: 1500, status: Status.CANCELADO
} satisfies Surgery;

test('spreadsheet identifies cancelled records and excludes their billable value', () => {
  const rows = buildSurgeryExportRows([cancelled, active]);

  assert.deepEqual(rows.map(row => row.Status), ['Realizado', 'Cancelado']);
  assert.deepEqual(rows.map(row => row['Valor Estimado']), [1000, 0]);
});

test('spreadsheet labels legacy records without status without discarding their value', () => {
  const legacy = { ...active, id: 'legacy', status: undefined } as unknown as Surgery;
  const [row] = buildSurgeryExportRows([legacy]);

  assert.equal(row.Status, 'Não informado');
  assert.equal(row['Valor Estimado'], 1000);
});
