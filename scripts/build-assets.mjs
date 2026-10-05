#!/usr/bin/env node
// Draws every SVG panel of the profile README from data/profile.json. Zero npm dependencies.
//
//   node scripts/build-assets.mjs                     static panels into assets/ (default)
//   node scripts/build-assets.mjs --static --out DIR  static panels into DIR instead
//   node scripts/build-assets.mjs --live --out DIR    the live pulse (reads the clock and the
//                                                     GitHub API with GH_TOKEN) into DIR
//   node scripts/build-assets.mjs --all --out DIR     both
//
// Static mode is deterministic: the same profile.json and glyph atlases give byte-identical
// files. Live mode is the only path that touches the network or the clock, and it exits
// non-zero rather than write a broken panel.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { themes } from './lib/tokens.mjs';
import { venture } from './lib/panels/venture.mjs';
import { experience } from './lib/panels/experience.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadProfile(path = join(ROOT, 'data/profile.json')) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Every static SVG, as [relative path, svg string]. The hero is not here: it is a frame of the
// three.js scene, rendered by scripts/render-scene.mjs and committed as JPEG.
export function staticFiles(profile) {
  const files = [];
  for (const theme of themes) {
    profile.ventures.forEach((v, i) => files.push([`ventures/${v.slug}-${theme}.svg`, venture(v, theme, i)]));
    files.push([`experience-${theme}.svg`, experience(profile.experience, theme)]);
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
  const has = (f) => argv.includes(f);
  const outIdx = argv.indexOf('--out');
  const out = outIdx >= 0 ? resolve(argv[outIdx + 1]) : null;
  const doLive = has('--live') || has('--all');
  const doStatic = has('--static') || has('--all') || !doLive;
  const profile = loadProfile();

  if (doStatic) {
    const dir = out ?? join(ROOT, 'assets');
    const files = staticFiles(profile);
    write(dir, files);
    console.log(`static: ${files.length} files -> ${dir}`);
  }
  if (doLive) {
    if (!out) throw new Error('--live needs --out <dir>');
    const { liveFiles } = await import('./lib/panels/pulse.mjs');
    const files = await liveFiles(profile, { token: process.env.GH_TOKEN, now: new Date() });
    write(out, files);
    console.log(`live: ${files.length} files -> ${out}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
