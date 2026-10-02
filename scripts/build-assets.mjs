#!/usr/bin/env node
// Draws every panel of the profile README from data/profile.json. Zero npm dependencies.
//
//   node scripts/build-assets.mjs                     static panels into assets/ (default)
//   node scripts/build-assets.mjs --static --out DIR  static panels into DIR instead
//
// Deterministic: the same profile.json and glyph atlases give byte-identical files.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { themes } from './lib/tokens.mjs';
import { hero } from './lib/panels/hero.mjs';
import { now } from './lib/panels/now.mjs';
import { route } from './lib/panels/route.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadProfile(path = join(ROOT, 'data/profile.json')) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Every static file, as [relative path, svg string].
export function staticFiles(profile) {
  const files = [];
  for (const theme of themes) {
    files.push([`hero-${theme}.svg`, hero(profile, theme)]);
    files.push([`now-${theme}.svg`, now(profile, theme)]);
    files.push([`route-${theme}.svg`, route(profile, theme)]);
  }
  return files;
}

function write(dir, files) {
  for (const [rel, svg] of files) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, svg);
  }
}

async function main(argv) {
  const outIdx = argv.indexOf('--out');
  const out = outIdx >= 0 ? resolve(argv[outIdx + 1]) : null;
  const profile = loadProfile();

  const dir = out ?? join(ROOT, 'assets');
  const files = staticFiles(profile);
  write(dir, files);
  console.log(`static: ${files.length} files -> ${dir}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
