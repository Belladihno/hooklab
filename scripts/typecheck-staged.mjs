import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const root = process.cwd();
const staged = spawnSync(
  'git',
  ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
  { encoding: 'utf8' },
);

if (staged.status !== 0) {
  console.error(staged.stderr.trim());
  process.exit(staged.status ?? 1);
}

const files = staged.stdout
  .split(/\r?\n/)
  .filter((file) => file.endsWith('.ts'))
  .filter((file) => file.startsWith('src/') || file.startsWith('test/'))
  .map((file) => join(root, file))
  .filter((file) => existsSync(file));

if (files.length === 0) {
  console.log('No staged TypeScript files to typecheck.');
  process.exit(0);
}

const cacheDirectory = join(root, 'node_modules', '.cache', 'typecheck-staged');
const configPath = join(cacheDirectory, 'tsconfig.json');

mkdirSync(cacheDirectory, { recursive: true });
writeFileSync(
  configPath,
  JSON.stringify(
    {
      extends: join(root, 'tsconfig.json'),
      compilerOptions: {
        incremental: false,
        declaration: false,
        declarationMap: false,
        noEmit: true,
        rootDir: root,
      },
      files,
    },
    null,
    2,
  ),
);

const tsc = createRequire(import.meta.url).resolve('typescript/lib/tsc.js');

try {
  const result = spawnSync(
    process.execPath,
    [tsc, '--noEmit', '-p', configPath],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );

  process.exitCode = result.status ?? 1;
} finally {
  rmSync(cacheDirectory, { recursive: true, force: true });
}
