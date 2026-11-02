import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render only: effects do not run, so these tests never contact Firestore.
const storage = { getItem: () => null, setItem: () => {} };
Object.assign(globalThis, {
  localStorage: storage, sessionStorage: storage,
  window: { innerWidth: 1440, location: { search: '', hash: '' }, atob, btoa },
  document: { documentElement: { dataset: { theme: 'dark' } } },
});
const { default: Management } = await import('../src/management/App.js');
for (const width of [390, 820, 1920]) {
  for (const theme of ['light', 'dark']) {
    test(`management entry exposes works and costs at ${width}px / ${theme}`, () => {
      (globalThis.window as unknown as { innerWidth: number }).innerWidth = width;
      document.documentElement.dataset.theme = theme;
      const html = renderToStaticMarkup(React.createElement(Management));
      assert.match(html, /Navegación principal/);
      assert.match(html, /Obras/);
      assert.match(html, /Documentos/);
      assert.match(html, /Personal/);
      assert.match(html, /Gastos/);
      assert.match(html, /Informes/);
      assert.doesNotMatch(html, /Residencial Las Palmas/);
    });
  }
}
