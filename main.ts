// Ember Pact's hand-in program (Node 22, standard library only): it copies the
// game/ folder and the screenshots/ folder from beside this file into the
// output directory and writes output/dossier.json, the summary the judge reads,
// with make.fun's vendored library. Nothing is installed, nothing is fetched,
// and two runs write the same bytes. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's own caps, passed through so this program refuses an entry the
// scorer would refuse: at most 4 screenshots of 256 KiB, at most 993 entries
// and 48 MiB under game/, paths under 1,000 bytes, dossier text under 160 KiB.
// Nothing here reads the clock or the network, so two runs write the same bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
