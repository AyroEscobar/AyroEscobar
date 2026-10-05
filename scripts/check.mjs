#!/usr/bin/env node
// Every rule for this profile that can be checked by code is checked here. The render-profile
// workflow runs it before drawing anything; run it locally before committing.
//
//   node scripts/check.mjs                       all checks
//   node scripts/check.mjs --facts <facts.json>  also resolve every factId against the private
//                                                facts file (local only; that file never ships)
//   node scripts/check.mjs --deny <denylist.txt> also keep the private deny-list off the page
//                                                (local only; DENYLIST_PATH works too)
//
// Rule -> check
//   no em or en dashes anywhere visible ................................. dashes
//   every image has alt text and sits inside a real link ................ links
//   every <picture> has both themes, and its <img> fallback is light .... themes
//   alt text in the README matches the <desc> inside the SVG ............ alt-matches-desc
//   SVGs are self-contained: no network, no script, no web fonts ........ svg-safety
//   every SVG has role="img", <title> and <desc> ......................... svg-a11y
//   size budget: 60 KB per SVG, 250 KB per theme ........................ size
//   one motion loop, in the hero only, behind prefers-reduced-motion .. motion
//   text 4.5:1 (large 3:1) and strokes 3:1 over the worst glass or field
//   composite each token may sit on, both themes ........................ contrast
//   every fact in profile.json carries a fact id (public with --facts) .. facts
//   the age appears once in the README and in no SVG .................... age
//   no third-party image hosts ........................................... image-hosts
//   names that stay off the page (list kept outside the repo) ........... gated
//   the static build is deterministic and matches what is committed ..... deterministic
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palettes, textOn } from './lib/tokens.mjs';
import { composite, ratio } from './lib/color.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argValue = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const factsPath = argValue('--facts') ? resolve(argValue('--facts')) : null;
const denyPath = argValue('--deny') || process.env.DENYLIST_PATH || null;

const findings = [];
const fail = (rule, msg) => findings.push(`[${rule}] ${msg}`);
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const readme = read('README.md');
const profileText = read('data/profile.json');
const profile = JSON.parse(profileText);
const svgPaths = walk(join(ROOT, 'assets')).filter((p) => p.endsWith('.svg'));
const svgs = new Map(svgPaths.map((p) => [relative(ROOT, p), readFileSync(p, 'utf8')]));

// dashes
for (const [name, text] of [['README.md', readme], ['data/profile.json', profileText], ...svgs]) {
  text.split('\n').forEach((line, i) => {
    if (/[–—]/.test(line)) fail('dashes', `${name}:${i + 1} has an em or en dash`);
  });
}

// links: walk the README's tags in order and track open <a href> elements
{
  let depth = 0;
  for (const m of readme.matchAll(/<a\b[^>]*\bhref="[^"]+"[^>]*>|<\/a>|<img\b[^>]*>/g)) {
    const tag = m[0];
    if (tag.startsWith('</a')) depth--;
    else if (tag.startsWith('<a')) depth++;
    else {
      const alt = tag.match(/\balt="([^"]*)"/);
      if (!alt || !alt[1].trim()) fail('links', `image without alt text: ${tag.slice(0, 80)}`);
      if (depth <= 0) fail('links', `image not inside a link: ${tag.slice(0, 80)}`);
    }
  }
}

// themes and alt-matches-desc
const pictures = [...readme.matchAll(/<picture>([\s\S]*?)<\/picture>/g)].map((m) => m[1]);
if (!pictures.length) fail('themes', 'README has no <picture> elements');
for (const pic of pictures) {
  const dark = pic.match(/<source media="\(prefers-color-scheme: dark\)" srcset="([^"]+)">/);
  const light = pic.match(/<source media="\(prefers-color-scheme: light\)" srcset="([^"]+)">/);
  const img = pic.match(/<img src="([^"]+)"[^>]*\balt="([^"]*)"/);
  if (!dark || !light || !img) {
    fail('themes', `a <picture> is missing its dark source, light source or img: ${pic.slice(0, 120)}`);
    continue;
  }
  if (dark[1].replace('-dark.svg', '') !== light[1].replace('-light.svg', '')) fail('themes', `mismatched pair ${dark[1]} / ${light[1]}`);
  // light first: the fallback is what a reader sees when the theme is unknown (the GitHub
  // Mobile app's behaviour is unverified), and the brief is bright
  if (img[1] !== light[1]) fail('themes', `img fallback ${img[1]} should be the light variant ${light[1]}`);
  for (const src of [dark[1], light[1]]) {
    if (src.startsWith('https://')) {
      if (unescape(img[2]) !== profile.pulse.alt) fail('alt-matches-desc', `${src}: alt differs from profile.pulse.alt`);
      continue;
    }
    if (!svgs.has(src)) {
      fail('themes', `${src} is referenced but does not exist`);
      continue;
    }
    const desc = svgs.get(src).match(/<desc id="d">([^<]*)<\/desc>/);
    if (!desc || unescape(desc[1]) !== unescape(img[2])) fail('alt-matches-desc', `${src}: README alt and SVG <desc> differ`);
  }
}

// svg-safety, svg-a11y, size, motion. svg-safety's '<image' does not match '<feImage': a
// <feImage href="#id"> is a local fragment, not an external image (none is used today).
const totals = {};
for (const [name, svg] of svgs) {
  const body = svg.replace('xmlns="http://www.w3.org/2000/svg"', '');
  for (const bad of ['http://', 'https://', '<script', '<foreignObject', '@font-face', '<image']) {
    if (body.includes(bad)) fail('svg-safety', `${name} contains ${bad}`);
  }
  if (!/^<svg [^>]*role="img"/.test(svg) || !svg.includes('<title id="t">') || !svg.includes('<desc id="d">')) {
    fail('svg-a11y', `${name} needs role="img", <title> and <desc> on the root`);
  }
  const size = Buffer.byteLength(svg);
  if (size > 60 * 1024) fail('size', `${name} is ${size} bytes (limit 61440)`);
  const theme = name.match(/-(dark|light)\.svg$/)?.[1];
  if (!theme) fail('themes', `${name} is not named -dark or -light`);
  else totals[theme] = (totals[theme] ?? 0) + size;

  if (svg.includes('<animate') || svg.includes('<set ')) fail('motion', `${name} uses SMIL animation; use CSS behind the reduced-motion guard`);
  const style = svg.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const guard = '@media (prefers-reduced-motion:no-preference){';
  const gi = style.indexOf(guard);
  const outside = gi >= 0 ? style.slice(0, gi) : style;
  if (/@keyframes|animation\s*:/.test(outside)) fail('motion', `${name} animates outside the reduced-motion guard`);
  if (gi >= 0 && !/^hero-(dark|light)\.svg$/.test(name.replace('assets/', ''))) fail('motion', `${name} animates; only the hero may`);
  if (gi >= 0) {
    const inner = style.slice(gi + guard.length);
    const loops = (inner.match(/@keyframes/g) ?? []).length;
    // one loop: anything moving inside an <img> redraws the whole filtered panel every frame
    if (loops > 1) fail('motion', `${name} has ${loops} loops (at most 1, the lens)`);
    for (const kf of inner.matchAll(/@keyframes \w+\{([\s\S]*?\})\}/g)) {
      for (const prop of kf[1].matchAll(/([a-z-]+):/g)) {
        if (!['opacity', 'transform', 'stroke-dashoffset'].includes(prop[1])) fail('motion', `${name} animates ${prop[1]}`);
      }
    }
  }
}
for (const [theme, total] of Object.entries(totals)) {
  if (total > 250 * 1024) fail('size', `the ${theme} set is ${total} bytes (limit 256000)`);
}

// contrast, computed from the tokens on the composite a reader actually sees: the base, the
// strongest blob of the field at full strength, and for glass the backdrop filter and the least
// tint (plus scrim) that ever sits under text. textOn in tokens.mjs says which token may sit on
// which surface and the ratio it needs there.
for (const [theme, pal] of Object.entries(palettes)) {
  for (const [surface, { need, tokens }] of Object.entries(textOn)) {
    for (const [blob, tone] of Object.entries(pal.field)) {
      const under = composite(pal, tone, surface);
      for (const tk of tokens) {
        const r = ratio(pal[tk], under);
        if (r < need) fail('contrast', `${theme}: ${tk} on ${surface} over ${blob} is ${r.toFixed(2)}:1 (needs ${need})`);
      }
    }
  }
  // strokes that carry meaning, all drawn on glass sheets: the spine and past rings (ink3),
  // the now beads and chip lines (accent)
  for (const [blob, tone] of Object.entries(pal.field)) {
    const under = composite(pal, tone, 'sheet');
    for (const fg of ['ink3', 'accent']) {
      const r = ratio(pal[fg], under);
      if (r < 3) fail('contrast', `${theme}: ${fg} strokes over ${blob} are ${r.toFixed(2)}:1 (need 3)`);
    }
  }
}

// facts: every object that states something carries factId or factIds
{
  const ids = new Set();
  const visit = (node, path) => {
    if (Array.isArray(node)) return node.forEach((n, i) => visit(n, `${path}[${i}]`));
    if (!node || typeof node !== 'object') return;
    const own = node.factIds ?? (node.factId ? [node.factId] : null);
    const states = Object.entries(node).some(([k, v]) => !['factId', 'factIds'].includes(k) && (typeof v === 'string' || typeof v === 'number'));
    if (states && path !== '$' && (!own || !own.length)) fail('facts', `${path} states facts but has no factIds`);
    (own ?? []).forEach((id) => ids.add(id));
    for (const [k, v] of Object.entries(node)) if (typeof v === 'object') visit(v, `${path}.${k}`);
  };
  visit(profile, '$');
  if (factsPath) {
    const facts = new Map(JSON.parse(readFileSync(factsPath, 'utf8')).map((f) => [f.id, f]));
    for (const id of ids) {
      if (!facts.has(id)) fail('facts', `fact id ${id} is not in ${factsPath}`);
      else if (facts.get(id).public !== true) fail('facts', `fact id ${id} is not public`);
    }
  }
}

// age
{
  const n = (readme.match(/\btwenty\b/gi) ?? []).length;
  if (n !== 1) fail('age', `"twenty" appears ${n} times in the README (exactly once, so it is a one-line edit)`);
  for (const [name, svg] of svgs) if (/\btwenty\b|\b20 years\b/i.test(svg)) fail('age', `${name} mentions his age`);
}

// image-hosts: relative assets, or this repo's own output branch for the pulse
for (const m of readme.matchAll(/\b(?:src|srcset)="([^"]+)"/g)) {
  const u = m[1];
  const ok = u.startsWith('assets/') || /^https:\/\/raw\.githubusercontent\.com\/AyroEscobar\/AyroEscobar\/output\/pulse-(dark|light)\.svg$/.test(u);
  if (!ok) fail('image-hosts', `image from somewhere else: ${u}`);
}

// gated: names that stay off the page. The list is private, so it lives outside the repo and
// is passed in. One term per line, # comments, case-insensitive, whole word. A blank line ends a
// group; a group whose comment says [site only] applies to ayroescobar.com and not to this page.
{
  if (!denyPath) console.log('gated: skipped (no deny file)');
  else if (!existsSync(resolve(denyPath))) fail('gated', `deny file not found: ${denyPath}`);
  else {
    const terms = [];
    for (const group of readFileSync(resolve(denyPath), 'utf8').split(/\n\s*\n/)) {
      const lines = group.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.some((l) => l.startsWith('#') && /\[site only\]/i.test(l))) continue;
      terms.push(...lines.filter((l) => !l.startsWith('#')));
    }
    // word edges get a boundary; an edge that is already punctuation (/hr, '27) does not need one
    const termRe = (t) => {
      const body = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`${/^\w/.test(t) ? '(?<!\\w)' : ''}${body}${/\w$/.test(t) ? '(?!\\w)' : ''}`, 'i');
    };
    const pages = [['README.md', readme], ['data/profile.json', profileText], ...svgs];
    for (const term of terms) {
      const re = termRe(term);
      for (const [name, text] of pages) if (re.test(text)) fail('gated', `${name} mentions "${term}"`);
    }
  }
}

// deterministic: build twice into temp folders, compare, and compare with assets/
{
  const base = mkdtempSync(join(tmpdir(), 'render-check-'));
  try {
    const outs = ['a', 'b'].map((k) => {
      const dir = join(base, k);
      execFileSync(process.execPath, [join(ROOT, 'scripts/build-assets.mjs'), '--static', '--out', dir], { stdio: 'pipe' });
      return new Map(walk(dir).map((p) => [relative(dir, p), readFileSync(p, 'utf8')]));
    });
    for (const [rel, text] of outs[0]) {
      if (outs[1].get(rel) !== text) fail('deterministic', `two builds of ${rel} differ`);
      const committed = join(ROOT, 'assets', rel);
      if (!existsSync(committed)) fail('deterministic', `assets/${rel} is missing; run node scripts/build-assets.mjs`);
      else if (readFileSync(committed, 'utf8') !== text) fail('deterministic', `assets/${rel} is stale; run node scripts/build-assets.mjs`);
    }
    for (const name of svgs.keys()) {
      if (!outs[0].has(relative('assets', name))) fail('deterministic', `${name} is not produced by the generator`);
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  console.error(`\n${findings.length} finding${findings.length === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log(`ok: ${svgs.size} svgs, ${pictures.length} pictures, 0 findings${factsPath ? ' (facts resolved)' : ''}`);
