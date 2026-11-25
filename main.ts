// Sushi Sprint — the entry program (Node 22, standard library only).
// It hands the game in: game/ and screenshots/ are copied from beside
// this file into /output, and /output/dossier.json is written with the
// vendored make.fun library, which summarises the game for the judge.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name) {
  const src = join(repoRoot, name);
  if (!existsSync(src)) return;
  cpSync(src, join(outDir, name), { recursive: true });
}

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    n += entry.isDirectory() ? countFiles(path) : 1;
  }
  return n;
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

// The scorer's caps, from the competition's gate: no more than 4
// screenshots (each at most 256 KiB), game/ at most 993 files and
// 48 MiB in all. Refuse loudly here rather than hand in a bad entry.
const shots = existsSync(join(repoRoot, 'screenshots'))
  ? readdirSync(join(repoRoot, 'screenshots')).filter((f) => !f.startsWith('.'))
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);
}
for (const shot of shots) {
  const bytes = statSync(join(repoRoot, 'screenshots', shot)).size;
  if (bytes > 262144) throw new Error(`screenshot ${shot} is ${bytes} bytes, over the 256 KiB cap`);
}
const gameFiles = countFiles(join(repoRoot, 'game'));
if (gameFiles > 993) throw new Error(`game/ holds ${gameFiles} files, over the 993 cap`);

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log('Sushi Sprint handed in: ' + shots.length + ' screenshots, ' + gameFiles + ' game files.');
