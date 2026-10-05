#!/usr/bin/env node
// Renders the README's two hero images from the boulder scene that ayroescobar.com runs live
// in three.js. GitHub runs no script, so the README shows frames of that scene: the night frame
// for GitHub's dark theme and the frame above the weather for its light theme, each with a
// glass name plate over it, switched by <picture> and prefers-color-scheme.
//
//   node scripts/render-scene.mjs [--scene DIR] [--shot FILE] [--only dark|light] [--keep DIR]
//
//   --scene  the folder that serves the scene: the site's built dist, or the approved prototype
//            (default $SCENE_DIR, else the a3 prototype on this machine). It must answer
//            /?t=<s>&p=<0..1>&ui=0&tier=full&noposter with a fixed clock, and serve
//            fonts/mona-sans-vf-latin.woff2.
//   --shot   the screenshot tool (default $SHOT_TOOL, else v2/tools/shot.mjs on this machine):
//            node shot.mjs <url> <out.png> --w --h --dpr --wait. Headless; it opens no window.
//   --only   render one theme.
//   --keep   also keep the raw and composed PNGs in DIR.
//
// What it does, per theme (the frame comes from data/scene.json, the words from profile.json hero):
//   1. serves the scene folder and a scratch folder on 127.0.0.1 (one server, stopped on exit);
//   2. captures the scene at the frame's fixed clock t and scroll progress p, chrome hidden, at
//      the frame's viewport (view) and DPR 2;
//   3. captures a compose page: that frame, cropped to 1280x640 at the frame's offset (crop),
//      rounded into GitHub's page colour, with the site's thick glass plate (backdrop blur over
//      the real frame, the 62% void scrim, the rim lit toward the rock) carrying the name;
//   4. encodes a progressive JPEG with ImageMagick, metadata stripped, at the highest quality
//      that fits the budget;
//   5. writes data/media.json: size, pixels and sha256 of each file, and the frame it shows,
//      which scripts/check.mjs verifies against the files.
//
// The frames are deterministic for a given scene build (fixed t, fixed p, hashed noise), so a
// re-render of an unchanged scene gives the same picture; the bytes may differ by GPU.
// Free tools only: Node, the headless Chrome behind the shot tool, ImageMagick.
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const SCENE = resolve(opt('--scene', process.env.SCENE_DIR || '/Users/ayroescobar/Desktop/HQ/personal-brand/v3/prototypes/a3'));
const SHOT = resolve(opt('--shot', process.env.SHOT_TOOL || '/Users/ayroescobar/Desktop/HQ/personal-brand/v2/tools/shot.mjs'));
const ONLY = opt('--only', null);
const KEEP = opt('--keep', null);

const OUT_W = 1280; // CSS px of the composed image; DPR 2 makes it 2560x1280
const OUT_H = 640;
const DPR = 2;
const PAGE = { dark: '#0d1117', light: '#ffffff' }; // GitHub's page colours, outside the rounded corners

const profile = JSON.parse(readFileSync(join(ROOT, 'data/profile.json'), 'utf8'));
const hero = profile.hero;
const scene = JSON.parse(readFileSync(join(ROOT, 'data/scene.json'), 'utf8'));
for (const p of [SCENE, SHOT, join(SCENE, 'fonts/mona-sans-vf-latin.woff2')]) {
  if (!existsSync(p)) throw new Error(`not found: ${p}`);
}

// ---- one static server: /__compose/* from the scratch folder, everything else from the scene
const scratch = mkdtempSync(join(tmpdir(), 'render-scene-'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const base = rel.startsWith('/__compose/') ? scratch : SCENE;
  if (rel.startsWith('/__compose/')) rel = rel.slice('/__compose'.length);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = join(base, rel);
  if (!file.startsWith(base) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});
let stopped = false;
const stop = () => {
  if (stopped) return;
  stopped = true;
  server.close();
  rmSync(scratch, { recursive: true, force: true });
};
process.on('exit', stop);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130));
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// async on purpose: the shot tool's Chrome loads pages from the server in this process
const run = promisify(execFile);
const shot = (url, out, w, h, wait) =>
  run(process.execPath, [SHOT, url, out, '--w', String(w), '--h', String(h), '--dpr', String(DPR), '--wait', String(wait)], { timeout: 120000 });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The compose page. The glass is the site's .glass--thick (v3/prototypes/a3/css/site.css):
// blur 20, saturate 190%, brightness 1.07, the light fill, a void scrim under the copy, the inner
// top line, the rock's cyan leaking in at the bottom, a 2 px conic rim whose bright side faces
// the rock. Nothing here is drawn by hand over the scene except that plate.
function composePage(theme, f) {
  const [nameA, nameB] = hero.plate.name;
  const T = scene.plate;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Mona Sans';src:url('/fonts/mona-sans-vf-latin.woff2') format('woff2');font-weight:400 800;font-stretch:75% 125%}
*{box-sizing:border-box}html,body{margin:0;width:${OUT_W}px;height:${OUT_H}px;overflow:hidden;background:${PAGE[theme]}}
.frame{position:absolute;inset:0;border-radius:${T.radius}px;overflow:hidden;isolation:isolate;
  background:#05060d url('frame.png') ${-f.crop.x}px ${-f.crop.y}px / ${f.view.w}px ${f.view.h}px no-repeat}
.plate{position:absolute;left:${f.plate.x}px;top:${f.plate.y}px;width:${f.plate.w}px;padding:34px 40px 38px;border-radius:26px;isolation:isolate;
  font-family:'Mona Sans',sans-serif;color:#f6fbff;-webkit-font-smoothing:antialiased;
  background:linear-gradient(155deg,rgb(255 255 255/.1) 0%,rgb(255 255 255/.06) 38%,rgb(255 255 255/.07) 100%),
    radial-gradient(130% 120% at 30% 55%,rgb(5 6 13/${f.plate.scrim}) 0%,rgb(5 6 13/${(f.plate.scrim * 0.72).toFixed(2)}) 70%,rgb(5 6 13/${(f.plate.scrim * 0.6).toFixed(2)}) 100%);
  -webkit-backdrop-filter:blur(20px) saturate(190%) brightness(1.07);backdrop-filter:blur(20px) saturate(190%) brightness(1.07);
  box-shadow:inset 0 1px 0 rgb(255 255 255/.55),inset 0 -1px 0 rgb(255 255 255/.06),inset 0 -40px 60px -50px rgb(25 230 255/.22),
    0 40px 90px -40px rgb(0 0 0/.85),0 12px 28px -14px rgb(0 0 0/.6)}
.plate::before{content:'';position:absolute;inset:0;border-radius:inherit;padding:2px;z-index:4;
  background:conic-gradient(from ${f.plate.rim - 180}deg,rgb(255 255 255/.05) 0deg,rgb(255 255 255/.08) 70deg,rgb(25 230 255/.35) 125deg,
    rgb(225 252 255/.95) 165deg,#fff 180deg,rgb(225 252 255/.95) 195deg,rgb(25 230 255/.35) 235deg,rgb(255 255 255/.08) 290deg,rgb(255 255 255/.05) 360deg);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.9}
.plate::after{content:'';position:absolute;inset:0;border-radius:inherit;z-index:3;
  background:radial-gradient(120% 46% at 50% -12%,rgb(255 255 255/.10),transparent 62%),
    linear-gradient(118deg,transparent 30%,rgb(255 255 255/.045) 40%,rgb(255 255 255/.07) 42%,transparent 52%)}
.plate>*{position:relative;z-index:5;margin:0}
.name{font-size:${T.nameSize}px;line-height:.94;font-weight:760;font-stretch:120%;letter-spacing:-.02em;margin-left:-4px}
.line{margin-top:22px;font-size:${T.lineSize}px;line-height:1.1;font-weight:560;font-stretch:104%;color:#dfe6f3}
.line b{font-weight:560;color:#19e6ff}
</style></head><body><div class="frame"><div class="plate">
<p class="name">${esc(nameA)}<br>${esc(nameB)}</p>
<p class="line">${esc(hero.plate.line)} <b>&#8599;</b></p>
</div></div></body></html>`;
}

// highest JPEG quality at or under the budget
function encode(png, jpg, budget) {
  for (let q = 92; q >= 70; q -= 2) {
    execFileSync('magick', [png, '-strip', '-colorspace', 'sRGB', '-sampling-factor', '4:2:0', '-interlace', 'Plane', '-quality', String(q), jpg]);
    const size = statSync(jpg).size;
    if (size <= budget) return { q, size };
  }
  throw new Error(`${jpg}: over ${budget} bytes even at quality 70`);
}

const media = existsSync(join(ROOT, 'data/media.json')) ? JSON.parse(readFileSync(join(ROOT, 'data/media.json'), 'utf8')) : { files: {} };
media.note = 'Written by scripts/render-scene.mjs; checked by scripts/check.mjs. Do not edit by hand.';
try {
  for (const theme of ['dark', 'light']) {
    if (ONLY && ONLY !== theme) continue;
    const f = scene[theme];
    const src = hero[theme];
    const raw = join(scratch, 'frame.png');
    const url = `${BASE}/?t=${f.t}&p=${f.p}&ui=0&tier=full&noposter`;
    await shot(url, raw, f.view.w, f.view.h, 4000);
    writeFileSync(join(scratch, 'index.html'), composePage(theme, f));
    const composed = join(scratch, `hero-${theme}.png`);
    await shot(`${BASE}/__compose/index.html`, composed, OUT_W, OUT_H, 1200);
    const out = join(ROOT, src);
    mkdirSync(dirname(out), { recursive: true });
    const { q, size } = encode(composed, out, scene.budget);
    if (KEEP) {
      mkdirSync(resolve(KEEP), { recursive: true });
      copyFileSync(raw, join(resolve(KEEP), `raw-${theme}.png`));
      copyFileSync(composed, join(resolve(KEEP), `hero-${theme}.png`));
    }
    media.files[src] = {
      bytes: size,
      width: OUT_W * DPR,
      height: OUT_H * DPR,
      quality: q,
      sha256: createHash('sha256').update(readFileSync(out)).digest('hex'),
      frame: { t: f.t, p: f.p, view: f.view, crop: f.crop, tier: 'full' },
    };
    console.log(`${src}: ${(size / 1024).toFixed(1)} KB at q${q} (t ${f.t}, p ${f.p})`);
  }
  media.files = Object.fromEntries(Object.entries(media.files).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(join(ROOT, 'data/media.json'), JSON.stringify(media, null, 2) + '\n');
} finally {
  stop();
}
