import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkerHourlyRate, isValidHourlyRate } from '../src/server/workerRates.js';
import { createPortalService } from '../src/server/replicaPortalService.js';
import { decodeState, type DocumentWrite } from '../src/server/replicaState.js';

test('rate precedence preserves configured rates, supports legacy hourlyRate, and rounds daily conversion', () => {
  assert.equal(resolveWorkerHourlyRate({ standardHourlyRate: 22, hourlyRate: 18.5, dailyRate: 148 }), 22);
  assert.equal(resolveWorkerHourlyRate({ hourlyRate: 18.5, dailyRate: 120 }), 18.5);
  assert.equal(resolveWorkerHourlyRate({ dailyRate: 123.45 }), 15.43);
  assert.equal(resolveWorkerHourlyRate({}), 18);
  assert.equal(resolveWorkerHourlyRate({ standardHourlyRate: Infinity, hourlyRate: -1 }), 18);
});
test('latest ZIP reference rates are available without creating workers or overriding explicit rates', () => {
  assert.equal(resolveWorkerHourlyRate({}, 'trab-emp-1788362023057'), 22);
  assert.equal(resolveWorkerHourlyRate({}, 'trab-emp-1788447093726'), 18.5);
  assert.equal(resolveWorkerHourlyRate({}, 'trab-emp-1788447139258'), 15.5);
  assert.equal(resolveWorkerHourlyRate({}, 'trab-emp-1791209906770'), 14.5);
  assert.equal(resolveWorkerHourlyRate({ standardHourlyRate: 25 }, 'trab-emp-1788362023057'), 25);
});
test('only finite positive hourly rates can be saved', () => {
  for (const valid of [18, 18.5, '22.00', 0.5]) assert.ok(isValidHourlyRate(valid));
  for (const invalid of [0, -1, Infinity, NaN, '', '18abc', 'Infinity', null, true, {}]) assert.ok(!isValidHourlyRate(invalid));
});
test('approval retains a historical shift rate after its worker rate changes', async () => {
  const state = decodeState('test-org', 'Test company', {
    workers: [{ id: 'test-worker', hourlyRate: 22, category: 'Test' }],
    records: [{ id: 'historical-shift', workerId: 'test-worker', projectId: 'test-work', type: 'check_out', hoursWorked: 2, hourlyRate: 18.5, calculatedCost: 37 }],
  });
  const writes: DocumentWrite[] = [];
  const service = createPortalService(state, writes, {});
  let status = 200, response: any;
  const res: any = { status(value: number) { status = value; return this; }, json(value: any) { response = value; return this; } };
  await service.handleApproveTimeRecord({ params: { id: 'historical-shift' }, body: {} } as any, res);
  assert.equal(status, 200);
  assert.equal(response.totalCost, 37);
  const cost = writes.find(write => write.collection === 'personal')!;
  assert.equal(cost.data.hourlyRate, 18.5);
  assert.equal(cost.data.totalCost, 37);
});
