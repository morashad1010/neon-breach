// NEON BREACH — entrypoint. Node 22, standard library only.
// Copies game/ and screenshots/ to /output and writes /output/dossier.json with the vendored
// make.fun library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// Caps the sealed scorer enforces: dossier text 160 KiB, at most 4 screenshots of 256 KiB each,
// game/ at most 993 entries and 48 MiB. /output as a whole: 1000 entries, 64 MiB.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);
console.log('dossier written to', outDir);
