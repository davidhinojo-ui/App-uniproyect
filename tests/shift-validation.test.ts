import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateShift } from '../src/server/shiftValidation.js';

const entry = { workerId: 'worker', projectId: 'project', type: 'check_in', timestamp: '2026-11-05T08:00:00Z' };
const now = '2026-11-05T10:00:00Z';
test('rejects duplicate entries across projects and ignores other workers', () => {
  assert.ok('error' in validateShift([entry], 'worker', 'other', 'check_in', now));
  assert.deepEqual(validateShift([entry], 'other', 'project', 'check_in', now), {});
});
test('rejects orphan, repeated, and wrong-project exits', () => {
  assert.ok('error' in validateShift([], 'worker', 'project', 'check_out', now));
  assert.ok('error' in validateShift([entry], 'worker', 'other', 'check_out', now));
  const exit = { ...entry, type: 'check_out', timestamp: now };
  assert.ok('error' in validateShift([entry, exit], 'worker', 'project', 'check_out', now));
  assert.deepEqual(validateShift([entry, exit], 'worker', 'project', 'check_in', now), {});
});
test('calculates actual elapsed hours without adding six minutes or eight hours', () => {
  assert.deepEqual(validateShift([entry], 'worker', 'project', 'check_out', now), { hoursWorked: 2 });
  assert.deepEqual(validateShift([entry], 'worker', 'project', 'check_out', entry.timestamp), { hoursWorked: 0 });
  assert.ok('error' in validateShift([entry], 'worker', 'project', 'check_out', 'invalid'));
  assert.ok('error' in validateShift([entry], 'worker', 'project', 'check_out', '2026-11-05T07:00:00Z'));
});
