import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuickGuidedActions } from '../src/components/supervisor/QuickGuidedActions.js';

test('all six guided actions are native keyboard-operable buttons with labels', () => {
  const noop = () => {};
  const markup = renderToStaticMarkup(React.createElement(QuickGuidedActions, {
    workers: [], projects: [], records: [], onOpenClockIn: noop,
    onOpenQrGenerator: noop, onNavigateToTab: noop, onOpenWorkerPortalLogin: noop,
  }));
  const buttons = [...markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)];
  assert.equal(buttons.length, 6);
  for (const button of buttons) {
    assert.match(button[0], /type="button"/);
    assert.match(button[1], /<h3\b[^>]*>[^<]+<\/h3>/);
    assert.doesNotMatch(button[1], /<button\b|<input\b|<a\b/);
  }
});
