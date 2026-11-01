import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
let commit = process.env.APP_BUILD_SHA || null;
let dirty = null;
try {
  commit ||= execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  dirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim());
} catch { /* AI Studio ZIP builds may not include .git; keep unknown metadata explicit. */ }
if (commit && !/^[0-9a-f]{7,40}$/i.test(commit)) throw new Error('APP_BUILD_SHA must be a Git commit SHA');
writeFileSync(new URL('../dist/version.json', import.meta.url), JSON.stringify({ app: 'UniProyect', version, commit, dirty }, null, 2) + '\n');
