import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createReplicaApp } from '../src/server/replicaApp.js';
import { decodeState, encodeState } from '../src/server/replicaState.js';
import { hashPin, verifyPin } from '../src/server/replicaSecurity.js';

test('PIN credentials are salted and reject legacy plaintext', () => {
  const first = hashPin('123456');
  assert.notEqual(first, hashPin('123456'));
  assert.ok(verifyPin('123456', first));
  assert.ok(!verifyPin('654321', first));
  assert.ok(!verifyPin('123456', '123456'));
});

test('protected API routes reject requests without a token before opening the store', async (context) => {
  const server = createReplicaApp(() => { throw new Error('Store must not be opened'); }).listen(0, '127.0.0.1');
  context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  for (const route of ['/api/supervisor/time-records', '/api/worker-portal/me', '/api/gemini/analyze']) {
    assert.equal((await fetch(base + route)).status, 401);
  }
  const alternateCase = await fetch(base + '/API/gemini/analyze', { method: 'POST' });
  assert.equal(alternateCase.status, 404);
});

test('persistent portal flow: QR, activation, authenticated shift, approval and restart', async () => {
  let persisted: any = {}, revision = 0;
  let simulateConflict = false;
  const rows: Record<string, any[]> = {};
  const factory: any = () => ({ config: { organizationId: 'test-org' },
    async supervisor(req: any) {
      if (req.headers.authorization !== 'Bearer supervisor-test') throw Object.assign(new Error('Denied'), { status: 401 });
      return { id: 'supervisor-test', rol: 'administrador' };
    },
    async load() { return { state: decodeState('test-org', 'Test company', structuredClone(persisted)), revision, management: structuredClone(rows) }; },
    async commit(expected: number, state: any, operations: any[]) {
      if (simulateConflict) { simulateConflict = false; revision++; return false; }
      if (revision !== expected) return false;
      persisted = encodeState(state); revision++;
      for (const operation of operations) {
        rows[operation.collection] ??= [];
        const previous = rows[operation.collection].filter(row => row.id !== operation.id);
        rows[operation.collection] = operation.action === 'set' ? [...previous, { ...operation.data, id: operation.id }] : previous;
      }
      return true;
    },
  });
  let server = createReplicaApp(factory).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = () => `http://127.0.0.1:${(server.address() as any).port}`;
  const request = async (url: string, body?: any, token?: string, method?: 'PUT' | 'PATCH') => {
    const response = await fetch(base() + url, { method: method ?? (body ? 'POST' : 'GET'), headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
  };
  try {
    assert.equal((await request('/api/supervisor/workers')).status, 401);
    const project = await request('/api/supervisor/projects', { name: 'Test work' }, 'supervisor-test');
    const created = await request('/api/supervisor/workers', { fullName: 'Test worker', category: 'Test', hourlyRate: 12, assignedProjectIds: [project.data.project.id] }, 'supervisor-test');
    assert.equal(created.status, 200);
    const id = created.data.worker.id;
    assert.equal((await request(`/api/supervisor/workers/${id}`, { hourlyRate: 18.5 }, undefined, 'PATCH')).status, 401);
    const tariff = await request(`/api/supervisor/workers/${id}`, { hourlyRate: 18.5, dniNie: 'test-id' }, 'supervisor-test', 'PATCH');
    assert.equal(tariff.status, 200);
    assert.equal(tariff.data.worker.dniNie, 'TEST-ID');
    assert.equal(tariff.data.worker.status, 'pending');
    assert.equal(rows.plantillaTrabajadores[0].standardHourlyRate, 18.5);
    assert.equal(rows.plantillaTrabajadores[0].hourlyRate, 18.5);
    assert.equal(rows.plantillaTrabajadores[0].dailyRate, 148);
    assert.equal(rows.plantillaTrabajadores[0].overtimeHourlyRate, 24.98);
    for (const invalidRate of [-1, 0, 'NaN', 'Infinity', null, true, '']) {
      assert.equal((await request(`/api/supervisor/workers/${id}`, { hourlyRate: invalidRate }, 'supervisor-test', 'PUT')).status, 400);
      assert.equal(rows.plantillaTrabajadores[0].standardHourlyRate, 18.5);
    }
    const invitation = await request('/api/worker-portal/invitation', { workerId: id }, 'supervisor-test');
    assert.equal(invitation.status, 200);
    const inviteToken = new URLSearchParams(invitation.data.activationUrl.split('?')[1]).get('token');
    assert.ok(inviteToken);
    assert.ok(!JSON.stringify(persisted).includes(inviteToken));
    assert.equal((await request(`/api/worker-portal/verify?token=${inviteToken}`)).status, 200);
    const activation = await request('/api/worker-portal/activate', { token: inviteToken, pin: '123456' });
    assert.equal(activation.status, 200);
    const workerToken = activation.data.token;
    assert.equal((await request('/api/worker-portal/activate', { token: inviteToken, pin: '123456' })).status, 410);
    assert.ok(!JSON.stringify(persisted).includes(workerToken));
    assert.ok(!JSON.stringify(persisted).includes('123456'));
    const me = await request('/api/worker-portal/me', undefined, workerToken);
    assert.equal(me.data.worker.id, id); assert.equal(me.data.worker.pin, undefined);
    assert.equal((await request('/api/worker-portal/time-records?workerId=other', undefined, workerToken)).status, 403);
    const params = { workerId: id, projectId: project.data.project.id };
    assert.equal((await request('/api/worker-portal/time-records', { ...params, type: 'check_out' }, workerToken)).status, 409);
    simulateConflict = true;
    const entry = await request('/api/worker-portal/time-records', { ...params, type: 'check_in' }, workerToken);
    assert.equal(entry.status, 200); assert.equal(persisted.records.length, 1);
    assert.equal((await request('/api/worker-portal/time-records', { ...params, type: 'check_in' }, workerToken)).status, 409);
    assert.equal((await request(`/api/supervisor/time-records/${entry.data.record.id}/approve`, {}, 'supervisor-test')).status, 409);
    assert.equal((await request(`/api/supervisor/workers/${id}`, { hourlyRate: 22 }, 'supervisor-test', 'PUT')).status, 200);
    const exit = await request('/api/worker-portal/time-records', { ...params, type: 'check_out' }, workerToken);
    assert.equal(exit.status, 200); assert.equal(exit.data.record.hoursWorked, 0);
    assert.equal(exit.data.record.hourlyRate, 18.5);
    assert.equal(persisted.records[0].hourlyRate, 18.5);
    assert.equal(rows.fichajes.length, 1); assert.equal(rows.fichajes[0].status, 'completed');
    assert.equal(rows.fichajes[0].clockIn, rows.fichajes[0].clockOut);
    const approved = await request(`/api/supervisor/time-records/${exit.data.record.id}/approve`, { managerName: 'Test manager' }, 'supervisor-test');
    assert.equal(approved.status, 200); assert.equal(approved.data.totalCost, 0);
    assert.equal((await request(`/api/supervisor/time-records/${exit.data.record.id}/approve`, {}, 'supervisor-test')).status, 200);
    assert.equal(rows.personal.length, 1); assert.equal(persisted.projects[0].laborCostTotal, 0);
    await new Promise<void>(resolve => server.close(() => resolve()));
    server = createReplicaApp(factory).listen(0, '127.0.0.1'); await once(server, 'listening');
    assert.equal((await request('/api/worker-portal/me', undefined, workerToken)).data.worker.id, id);
    assert.equal((await request('/api/worker-portal/me', undefined, workerToken)).data.worker.hourlyRate, 22);
    assert.equal((await request(`/api/worker-portal/time-records?workerId=${id}`, undefined, workerToken)).data.records.length, 2);
    const workerLogin = await request('/api/worker-portal/login', { identifier: id, pin: '123456' });
    assert.equal(workerLogin.status, 200);
    const removed = structuredClone(rows.plantillaTrabajadores);
    rows.plantillaTrabajadores = [];
    assert.equal((await request('/api/worker-portal/me', undefined, workerToken)).status, 401);
    rows.plantillaTrabajadores = removed;
    assert.equal((await request('/api/worker-portal/me', undefined, workerToken)).status, 401);
    const freshLogin = await request('/api/worker-portal/login', { identifier: id, pin: '123456' });
    // Removing the master worker also discards its credentials; a new invitation is required.
    assert.equal(freshLogin.status, 403);
    const revoked = await request(`/api/supervisor/workers/${id}/revoke-portal`, {}, 'supervisor-test');
    assert.equal(revoked.status, 200);
    assert.equal((await request('/api/worker-portal/me', undefined, workerToken)).status, 401);
    for (let i=0;i<5;i++) await request('/api/worker-portal/login', { identifier: 'nonexistent', pin: '000000' });
    assert.equal((await request('/api/worker-portal/login', { identifier: 'nonexistent', pin: '000000' })).status, 429);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
