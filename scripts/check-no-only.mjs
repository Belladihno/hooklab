import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['src', 'test'];
const pattern =
  /\b(?:describe|it|test|suite|bench)(?:\.[A-Za-z_$][\w$]*)*\.only\s*\(/;
const failures = [];

function walk(path) {
  if (statSync(path).isDirectory()) {
    if (path.includes('node_modules') || path.includes('dist')) return;
    for (const entry of readdirSync(path)) walk(join(path, entry));
    return;
  }

  if (!/\.(ts|mjs|js)$/.test(path)) return;

  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (pattern.test(line)) {
      failures.push(`${relative(process.cwd(), path)}:${index + 1}`);
    }
  });
}

for (const root of roots) walk(root);

if (failures.length > 0) {
  console.error('Focused tests (.only) are not allowed:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('No focused tests: ok');
