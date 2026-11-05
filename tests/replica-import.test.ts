import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore — import preparation is also a standalone Node command.
import { prepareImport } from '../scripts/prepare-supabase-import.mjs';
test('backup preparation preserves business fields and maps the original collections', () => {
  const document = { id: 'legacy-doc-1', products: [{ amount: 2, price: 12.5 }], totalAmount: 30.25, fileBase64: 'test' };
  const result = prepareImport({ data: { documentos: [document], trabajadoresEmpresa: [{ id: 'worker-1', name: 'Test', pin: '1234' }], fichajes: [{ id: 'shift-1', totalHours: 0 }] } });
  assert.equal(result.operations.length, 3);
  assert.deepEqual(result.operations.find((op: any) => op.collection === 'documentos').data, document);
  assert.equal(result.operations.find((op: any) => op.collection === 'plantillaTrabajadores').data.pin, undefined);
  assert.equal(result.operations.find((op: any) => op.collection === 'fichajes').data.totalHours, 0);
});
test('backup preparation rejects duplicate or missing identities', () => {
  assert.throws(() => prepareImport({ obras: [{ id: 'a' }, { id: 'a' }] }));
  assert.throws(() => prepareImport({ obras: [{ name: 'Missing identity' }] }));
  assert.throws(() => prepareImport({}));
});
