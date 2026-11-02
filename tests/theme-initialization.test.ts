import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
for (const saved of ['light', 'dark', 'invalid', null, 'blocked']) {
  test(`theme before React starts: ${saved}`, () => {
    const document = {
      documentElement: { dataset: {} as Record<string, string>, style: { colorScheme: '' } },
      querySelector: () => ({ setAttribute: (_: string, value: string) => { meta = value; } }),
    };
    let meta = '';
    runInNewContext(script, { document, localStorage: { getItem() {
      if (saved === 'blocked') throw new Error('Storage unavailable');
      return saved;
    } } });
    const expected = saved === 'light' ? 'light' : 'dark';
    assert.equal(document.documentElement.dataset.theme, expected);
    assert.equal(document.documentElement.style.colorScheme, expected);
    assert.equal(meta, expected === 'light' ? '#f8fafc' : '#090d16');
    assert.ok(html.indexOf('name="theme-color"') < html.indexOf('<script>'));
  });
}
