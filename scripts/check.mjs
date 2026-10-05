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
//   alt text in the README matches the <desc> inside each SVG ........... alt-matches-desc
//   alt text on a raster matches its profile.json entry ................. alt-matches-profile
//   SVGs are self-contained: no network, no script, no web fonts ........ svg-safety
//   every SVG has role="img", <title> and <desc> ......................... svg-a11y
//   60 KB per SVG; 300 KB per hero JPEG, 1.2 MB for a GIF; 1 MB per theme size
//   rasters: real JPEG/PNG/GIF, no metadata, pixels, bytes and sha256 as
//   data/media.json (written by render-scene.mjs) records them ......... raster
//   no SVG animates; a GIF is the one loop allowed, hero only ........... motion
//   text 4.5:1 on the glass scrim over the brightest tone of the world,
//   both themes ......................................................... contrast
//   every fact in profile.json carries a fact id (public with --facts) .. facts
//   the only projects are Esvo Technologies and Viaere .................. projects-empty
//   no age anywhere: "twenty" and "20 years" appear zero times .......... age
//   every way to reach him is ayro@esvotech.com ......................... contact
//   an image that shows the figure carries its CC BY credit ............. credit
//   no third-party image hosts ........................................... image-hosts
//   names that stay off the page (list kept outside the repo) ........... gated
//   the SVG build is deterministic and matches what is committed ........ deterministic
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palettes, textOn } from './lib/tokens.mjs';
import { composite, ratio } from './lib/color.mjs';
import { createHash } from 'node:crypto';

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
const assetPaths = walk(join(ROOT, 'assets'));
const svgs = new Map(assetPaths.filter((p) => p.endsWith('.svg')).map((p) => [relative(ROOT, p), readFileSync(p, 'utf8')]));
const RASTER = /\.(jpe?g|png|gif)$/i;
const rasters = new Map(assetPaths.filter((p) => RASTER.test(p)).map((p) => [relative(ROOT, p), readFileSync(p)]));
const media = existsSync(join(ROOT, 'data/media.json')) ? JSON.parse(read('data/media.json')) : { files: {} };
// raster alt text lives in profile.json: the hero's two frames share one alt
const rasterAlt = new Map([[profile.hero?.dark, profile.hero?.alt], [profile.hero?.light, profile.hero?.alt]].filter(([k]) => k));
for (const p of assetPaths) {
  if (!p.endsWith('.svg') && !RASTER.test(p) && !/LICENSE[^/]*\.txt$/.test(p)) fail('raster', `${relative(ROOT, p)}: only SVG, JPEG, PNG, GIF and licence text belong in assets/`);
}

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
  if (dark[1].replace(/-dark(\.\w+)$/, '$1') !== light[1].replace(/-light(\.\w+)$/, '$1')) fail('themes', `mismatched pair ${dark[1]} / ${light[1]}`);
  // light first: the fallback is what a reader sees when the theme is unknown (the GitHub
  // Mobile app's behaviour is unverified)
  if (img[1] !== light[1]) fail('themes', `img fallback ${img[1]} should be the light variant ${light[1]}`);
  const alt = unescape(img[2]);
  for (const src of [dark[1], light[1]]) {
    if (src.startsWith('https://')) {
      if (alt !== profile.pulse.alt) fail('alt-matches-desc', `${src}: alt differs from profile.pulse.alt`);
      continue;
    }
    if (RASTER.test(src)) {
      if (!rasters.has(src)) fail('themes', `${src} is referenced but does not exist`);
      if (!rasterAlt.has(src)) fail('alt-matches-profile', `${src} has no entry in profile.json`);
      else if (rasterAlt.get(src) !== alt) fail('alt-matches-profile', `${src}: README alt and profile.json alt differ`);
      continue;
    }
    if (!svgs.has(src)) {
      fail('themes', `${src} is referenced but does not exist`);
      continue;
    }
    const desc = svgs.get(src).match(/<desc id="d">([^<]*)<\/desc>/);
    if (!desc || unescape(desc[1]) !== alt) fail('alt-matches-desc', `${src}: README alt and SVG <desc> differ`);
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
  // the hero is a still frame now; anything moving inside an <img> redraws a filtered panel
  // every frame, so no SVG animates
  if (svg.includes('<animate') || svg.includes('<set ') || /@keyframes|animation\s*:/.test(svg)) fail('motion', `${name} animates; no SVG may`);
}

// raster: what render-scene.mjs wrote is what is committed, and nothing personal rides along
const readmeSrcs = new Set([...readme.matchAll(/\b(?:src|srcset)="([^"]+)"/g)].map((m) => m[1]));
function jpegInfo(buf) {
  const out = { meta: [], progressive: false };
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1];
    if (m === 0xd9 || m === 0xda) break;
    const len = buf.readUInt16BE(i + 2);
    const seg = buf.subarray(i + 4, i + 2 + len);
    if (m === 0xe1) out.meta.push(seg.subarray(0, 4).toString('latin1') === 'Exif' ? 'Exif' : 'XMP');
    if (m === 0xed) out.meta.push('IPTC');
    if (m === 0xfe) out.meta.push('comment');
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
      out.height = seg.readUInt16BE(1);
      out.width = seg.readUInt16BE(3);
      out.progressive = m === 0xc2;
    }
    i += 2 + len;
  }
  return out;
}
const isHero = (name) => /^assets\/hero-(dark|light)\.(jpe?g|png)$/.test(name);
for (const [name, buf] of rasters) {
  const theme = name.match(/-(dark|light)\.\w+$/)?.[1];
  const gif = /\.gif$/i.test(name);
  if (!readmeSrcs.has(name)) fail('raster', `${name} is committed but the README never shows it`);
  if (gif) {
    if (buf.subarray(0, 6).toString('latin1') !== 'GIF89a') fail('raster', `${name} is not a GIF89a`);
    if (buf.length > 1.2 * 1024 * 1024) fail('size', `${name} is ${buf.length} bytes (limit 1258291)`);
    if (!/^assets\/hero-loop/.test(name)) fail('motion', `${name}: a loop is allowed in the hero only`);
    console.log(`motion: warning, ${name} loops and a GIF ignores prefers-reduced-motion; keep it only on purpose`);
  } else if (/\.jpe?g$/i.test(name)) {
    const info = jpegInfo(buf);
    if (!info) fail('raster', `${name} is not a JPEG`);
    else {
      if (info.meta.length) fail('raster', `${name} carries ${info.meta.join(', ')} metadata; strip it`);
      if (isHero(name) && (info.width !== 2560 || info.height !== 1280)) fail('raster', `${name} is ${info.width}x${info.height}, not 2560x1280`);
      const rec = media.files?.[name];
      if (rec && (rec.width !== info.width || rec.height !== info.height)) fail('raster', `${name}: pixels differ from data/media.json`);
    }
    if (isHero(name) && buf.length > 300 * 1024) fail('size', `${name} is ${buf.length} bytes (limit 307200)`);
  } else if (buf.subarray(1, 4).toString('latin1') !== 'PNG') fail('raster', `${name} is not a PNG`);
  const rec = media.files?.[name];
  if (!rec) fail('raster', `${name} is not in data/media.json; render it with node scripts/render-scene.mjs`);
  else {
    if (rec.bytes !== buf.length) fail('raster', `${name} is ${buf.length} bytes, data/media.json says ${rec.bytes}`);
    if (rec.sha256 !== createHash('sha256').update(buf).digest('hex')) fail('raster', `${name} differs from the render data/media.json records`);
  }
  if (!gif) {
    if (!theme) fail('themes', `${name} is not named -dark or -light`);
    else totals[theme] = (totals[theme] ?? 0) + buf.length;
  }
}
for (const name of Object.keys(media.files ?? {})) if (!rasters.has(name)) fail('raster', `data/media.json lists ${name}, which is not committed`);
for (const [theme, total] of Object.entries(totals)) {
  if (total > 1024 * 1024) fail('size', `the ${theme} set is ${total} bytes (limit 1048576, the GIF excluded)`);
}

// contrast, computed from the tokens on the composite a reader actually sees: every tone of
// the world at full strength, through the glass filter, under the void scrim and the least
// light fill. All panel copy sits on the scrim (textOn in tokens.mjs).
for (const [theme, pal] of Object.entries(palettes)) {
  for (const [, { need, tokens }] of Object.entries(textOn)) {
    for (const [tone, t] of Object.entries(pal.field)) {
      const under = composite(pal, t);
      for (const tk of tokens) {
        const r = ratio(pal[tk], under);
        if (r < need) fail('contrast', `${theme}: ${tk} on the scrim over ${tone} is ${r.toFixed(2)}:1 (needs ${need})`);
      }
      // strokes that carry meaning: the route line and past beads (ink3), the now beads (accent)
      for (const fg of ['ink3', 'accent']) {
        const r = ratio(pal[fg], under);
        if (r < 3) fail('contrast', `${theme}: ${fg} strokes over ${tone} are ${r.toFixed(2)}:1 (need 3)`);
      }
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
  const need = {
    esvo: ['ven-esvo', 'ven-esvo-site', 'ln-esvo'],
    viaere: ['ven-viaere', 'ven-viaere-bio', 'ven-viaere-tagline', 'ven-viaere-cofounders', 'ln-viaere'],
  };
  for (const v of profile.ventures ?? []) {
    for (const id of need[v.slug] ?? []) if (!(v.factIds ?? []).includes(id)) fail('facts', `ventures.${v.slug} must cite ${id}`);
  }
  if (factsPath) {
    const facts = new Map(JSON.parse(readFileSync(factsPath, 'utf8')).map((f) => [f.id, f]));
    for (const id of ids) {
      if (!facts.has(id)) fail('facts', `fact id ${id} is not in ${factsPath}`);
      else if (facts.get(id).public !== true) fail('facts', `fact id ${id} is not public`);
    }
  }
}

// age: none, anywhere
{
  for (const [name, text] of [['README.md', readme], ['data/profile.json', profileText], ...svgs]) {
    if (/\btwenty\b|\b20 years\b/i.test(text)) fail('age', `${name} mentions his age`);
  }
}

// projects-empty: the only projects are Esvo Technologies and Viaere, in that order
{
  if ((profile.projects ?? []).length) fail('projects-empty', `profile.projects has ${profile.projects.length} entries (none)`);
  if (/^##\s+built\b/m.test(readme)) fail('projects-empty', 'the README still has a ## built section');
  const slugs = (profile.ventures ?? []).map((v) => v.slug).join(',');
  if (slugs !== 'esvo,viaere') fail('projects-empty', `ventures are ${slugs || 'none'} (esvo,viaere)`);
  const cards = [...readme.matchAll(/<a href="(https:\/\/[^"]+)">\s*<picture>/g)].map((m) => m[1]);
  const extra = cards.filter((u) => !['https://ayroescobar.com', 'https://esvotech.com', 'https://viaere.com'].includes(u));
  if (extra.length) fail('projects-empty', `the README links a picture to ${extra.join(', ')}`);
  if (svgs.size && [...svgs.keys()].some((n) => n.startsWith('assets/projects/'))) fail('projects-empty', 'assets/projects/ still has cards');
}

// contact: every way to reach him is ayro@esvotech.com
{
  const EMAIL = 'ayro@esvotech.com';
  if (profile.links?.email !== `mailto:${EMAIL}`) fail('contact', `profile links.email is ${profile.links?.email}`);
  const mailtos = [...readme.matchAll(/mailto:([^"\s)>]+)/g)].map((m) => m[1]);
  if (!mailtos.length) fail('contact', 'the README has no mailto link');
  for (const m of mailtos) if (m !== EMAIL) fail('contact', `the README mails ${m}`);
  for (const m of readme.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) if (m[0] !== EMAIL) fail('contact', `the README shows the address ${m[0]}`);
}

// credit: the hero frames show the CC BY 3.0 figure, so the README credits it with both links
// and its licence note sits beside the images
{
  if (profile.hero?.showsFigure) {
    const credit = /3D figure: <a href="https:\/\/poly\.pizza\/m\/eWGDnQ0jzmH">Male base<\/a> by Артур Мигранов, <a href="https:\/\/creativecommons\.org\/licenses\/by\/3\.0\/">CC BY 3\.0<\/a>/;
    if (!credit.test(readme)) fail('credit', 'the README shows the figure without its CC BY 3.0 credit line');
    if (!existsSync(join(ROOT, 'assets/LICENSE-figure.txt'))) fail('credit', 'assets/LICENSE-figure.txt is missing');
  }
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
console.log(`ok: ${svgs.size} svgs, ${rasters.size} rasters, ${pictures.length} pictures, 0 findings${factsPath ? ' (facts resolved)' : ''}`);
