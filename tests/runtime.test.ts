import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';

let server: ChildProcess;
let base: string;
before(async () => {
  // Ask the OS for a free port rather than assuming the Cloud Run default.
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['dist/server.cjs'], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production' }, stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* startup pending */ }
    if (server.exitCode !== null) throw new Error('Production server exited before becoming healthy');
    await setTimeout(100);
  }
  throw new Error('Production server did not honour PORT within 5 seconds');
});
after(async () => {
  if (server && server.exitCode === null) {
    const closed = once(server, 'close');
    server.kill();
    await closed;
  }
});

test('production entry honours PORT and returns healthy JSON', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  assert.equal((await response.json()).status, 'ok');
});
test('production serves SPA routes and every referenced build asset', async () => {
  const response = await fetch(`${base}/portal/validation-route`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /id="root"/);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)];
  assert.ok(assets.length >= 2);
  for (const [, asset] of assets) {
    const result = await fetch(`${base}${asset}`);
    assert.equal(result.status, 200);
    assert.doesNotMatch(result.headers.get('content-type') || '', /text\/html/);
  }
});
test('version manifest exposes build identification and no configuration', async () => {
  const response = await fetch(`${base}/version.json`);
  const version = await response.json();
  assert.equal(version.app, 'UniProyect');
  assert.equal(version.version, '1.0.2');
  assert.deepEqual(Object.keys(version).sort(), ['app', 'commit', 'dirty', 'version']);
  assert.ok(version.commit === null || /^[0-9a-f]{7,40}$/i.test(version.commit));
});
