import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const css = postcss.parse(readFileSync(new URL('../src/index.css', import.meta.url), 'utf8'));
function colorFor(selector: string, property = 'color') {
  let value = '';
  css.walkRules(rule => {
    if (rule.selector === selector) rule.walkDecls(property, declaration => { value = declaration.value; });
  });
  assert.match(value, /^#[0-9a-f]{6}$/i, `Missing concrete palette value: ${selector} / ${property}`);
  return value;
}
function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(fg: string, bg: string) {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const hue of ['blue', 'emerald', 'amber', 'rose']) {
  for (const state of ['', '-hover']) {
    test(`AA: white action text on ${hue}${state}, both themes`, () => {
      const background = colorFor(':root', `--up-action-${hue}${state}`);
      const ratio = contrast('#ffffff', background);
      assert.ok(ratio >= 4.5, `Contrast ${ratio.toFixed(2)}:1 < 4.5:1`);
    });
  }
}
for (const [selectors, surfaces] of [
  [['html:not([data-theme="light"]) :is(.text-slate-400, .text-slate-500)'], ['#090d16', '#0f172a', '#1e293b', '#334155']],
  [[
    'html[data-theme="light"] .text-white',
    'html[data-theme="light"] .text-slate-100,\nhtml[data-theme="light"] .text-slate-200',
    'html[data-theme="light"] .text-slate-300,\nhtml[data-theme="light"] .text-slate-400',
    'html[data-theme="light"] .text-slate-500',
    'html[data-theme="light"] .text-blue-400,\nhtml[data-theme="light"] .text-blue-300',
    'html[data-theme="light"] .text-emerald-200,\nhtml[data-theme="light"] .text-emerald-400,\nhtml[data-theme="light"] .text-emerald-300',
    'html[data-theme="light"] .text-amber-400,\nhtml[data-theme="light"] .text-amber-300',
    'html[data-theme="light"] .text-rose-200,\nhtml[data-theme="light"] .text-rose-400,\nhtml[data-theme="light"] .text-rose-300',
    'html[data-theme="light"] :is(.text-purple-300, .text-purple-400)',
    'html[data-theme="light"] :is(.text-sky-300, .text-sky-400)',
  ], ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#eff6ff', '#eef2ff', '#ecfdf5']],
] as const) {
  for (const selector of selectors) {
    test(`AA: palette ${selector.replaceAll('\n', ' ')}`, () => {
      const foreground = colorFor(selector);
      for (const background of surfaces) {
        const ratio = contrast(foreground, background);
        assert.ok(ratio >= 4.5, `${foreground} / ${background}: ${ratio.toFixed(2)}:1`);
      }
    });
  }
}
