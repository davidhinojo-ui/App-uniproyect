import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
// Build runs before tests in CI; import the exact serverless adapter deployed by Vercel.
// @ts-ignore — generated CommonJS bundle is consumed through the JavaScript adapter.
import app from '../api/index.js';

test('Vercel adapter starts the compiled app and handles nested API paths', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');
    const protectedRoute = await fetch(`${base}/api/supervisor/workers`);
    assert.ok([401, 503].includes(protectedRoute.status));
    assert.match(protectedRoute.headers.get('content-type') || '', /application\/json/);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
