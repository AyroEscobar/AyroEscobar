#!/usr/bin/env python3
"""Build the glyph atlases the SVG generator uses.

Run once, offline, whenever the fonts change. The JSON it writes is committed and is the
only font data the generator (and the Action) ever reads, so no font file ships in the repo
and nothing is embedded with @font-face.

  python3 scripts/fonts/make-atlas.py [--cache DIR]

It downloads Overpass[wght].ttf and OverpassMono[wght].ttf from github.com/google/fonts
(ofl/overpass, ofl/overpassmono; SIL OFL 1.1, no Reserved Font Name), pins each to one
weight with fontTools' instancer, and writes, per glyph in printable ASCII plus the middle
dot (U+00B7): its outline as a compact SVG path at 1000 units per em with y pointing down
and the baseline at 0, and its advance width. Pair kerning from the font's GPOS 'kern'
feature is flattened into a lookup table for the same glyphs.

Needs: python3 with fontTools (pip install fonttools).
"""
import argparse
import json
import os
import tempfile
import urllib.request

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl"
TARGET_UPM = 1000
CHARS = [chr(c) for c in range(0x20, 0x7F)] + ["·"]

FONTS = [
    {
        "out": "overpass-900.json",
        "family": "Overpass",
        "file": "Overpass[wght].ttf",
        "url": f"{BASE}/overpass/Overpass%5Bwght%5D.ttf",
        "ofl_url": f"{BASE}/overpass/OFL.txt",
        "ofl_out": "OFL-Overpass.txt",
        "wght": 900,
    },
    {
        "out": "overpass-mono-500.json",
        "family": "Overpass Mono",
        "file": "OverpassMono[wght].ttf",
        "url": f"{BASE}/overpassmono/OverpassMono%5Bwght%5D.ttf",
        "ofl_url": f"{BASE}/overpassmono/OFL.txt",
        "ofl_out": "OFL-OverpassMono.txt",
        "wght": 500,
    },
]


class CompactPathPen(BasePen):
    """Writes relative SVG path commands with integer coordinates.

    Points are scaled to TARGET_UPM, y is flipped, and every point is rounded in absolute
    terms before the relative step is taken, so rounding never accumulates.
    """

    def __init__(self, glyph_set, scale):
        super().__init__(glyph_set)
        self.scale = scale
        self.cmds = []
        self.cur = (0, 0)
        self.start = (0, 0)

    def _pt(self, p):
        return (round(p[0] * self.scale), round(-p[1] * self.scale))

    def _rel(self, p):
        return (p[0] - self.cur[0], p[1] - self.cur[1])

    def _moveTo(self, p):
        q = self._pt(p)
        dx, dy = self._rel(q)
        self.cmds.append(("m", (dx, dy)))
        self.cur = self.start = q

    def _lineTo(self, p):
        q = self._pt(p)
        dx, dy = self._rel(q)
        if dx == 0 and dy == 0:
            return
        if dy == 0:
            self.cmds.append(("h", (dx,)))
        elif dx == 0:
            self.cmds.append(("v", (dy,)))
        else:
            self.cmds.append(("l", (dx, dy)))
        self.cur = q

    def _qCurveToOne(self, p1, p2):
        a, b = self._pt(p1), self._pt(p2)
        self.cmds.append(("q", (*self._rel(a), *self._rel(b))))
        self.cur = b

    def _curveToOne(self, p1, p2, p3):
        a, b, c = self._pt(p1), self._pt(p2), self._pt(p3)
        self.cmds.append(("c", (*self._rel(a), *self._rel(b), *self._rel(c))))
        self.cur = c

    def _closePath(self):
        self.cmds.append(("z", ()))
        self.cur = self.start

    _endPath = _closePath

    def d(self):
        out = []
        for cmd, args in self.cmds:
            s = cmd
            for i, n in enumerate(args):
                t = str(n)
                # A minus sign separates numbers on its own; otherwise a space is needed.
                s += t if (i == 0 or t.startswith("-")) else " " + t
            out.append(s)
        return "".join(out)


def fetch(url, path):
    if not os.path.exists(path):
        print("download", url)
        urllib.request.urlretrieve(url, path)
    return path


def kern_table(font, names, scale):
    """Flatten GPOS pair kerning (feature 'kern') for the given glyph names."""
    if "GPOS" not in font:
        return {}
    gpos = font["GPOS"].table
    lookup_ids = set()
    for fr in gpos.FeatureList.FeatureRecord:
        if fr.FeatureTag == "kern":
            lookup_ids.update(fr.Feature.LookupListIndex)
    totals = {}
    for li in sorted(lookup_ids):
        lookup = gpos.LookupList.Lookup[li]
        subtables = []
        for st in lookup.SubTable:
            if lookup.LookupType == 9:
                st = st.ExtSubTable
            if st.LookupType == 2:
                subtables.append(st)
        for a in names:
            for b in names:
                for st in subtables:
                    cov = st.Coverage.glyphs
                    if a not in cov:
                        continue
                    if st.Format == 1:
                        ps = st.PairSet[cov.index(a)]
                        rec = next((r for r in ps.PairValueRecord if r.SecondGlyph == b), None)
                        if rec is None:
                            continue  # this subtable does not apply; try the next one
                        v = getattr(rec.Value1, "XAdvance", 0) if rec.Value1 else 0
                    else:
                        c1 = st.ClassDef1.classDefs.get(a, 0)
                        c2 = st.ClassDef2.classDefs.get(b, 0)
                        rec = st.Class1Record[c1].Class2Record[c2]
                        v = getattr(rec.Value1, "XAdvance", 0) if rec.Value1 else 0
                    if v:
                        totals[(a, b)] = totals.get((a, b), 0) + v
                    break
    return totals


def build(spec, cache):
    src = fetch(spec["url"], os.path.join(cache, spec["file"]))
    ofl = fetch(spec["ofl_url"], os.path.join(cache, spec["ofl_out"]))
    with open(ofl, encoding="utf-8") as fh:
        ofl_text = fh.read()
    if "Reserved Font Name" in ofl_text.split("PREAMBLE")[0]:
        raise SystemExit(f"{spec['family']}: the OFL notice declares a Reserved Font Name; stop and review")
    with open(os.path.join(HERE, spec["ofl_out"]), "w", encoding="utf-8") as fh:
        fh.write(ofl_text)

    vf = TTFont(src)
    version = vf["name"].getDebugName(5)
    copyright_ = vf["name"].getDebugName(0)
    font = instancer.instantiateVariableFont(vf, {"wght": spec["wght"]})
    upm = font["head"].unitsPerEm
    scale = TARGET_UPM / upm
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font["hmtx"]
    os2 = font["OS/2"]

    glyphs = {}
    names = {}
    for ch in CHARS:
        gname = cmap.get(ord(ch))
        if gname is None:
            raise SystemExit(f"{spec['family']}: no glyph for {ch!r}")
        pen = CompactPathPen(gs, scale)
        gs[gname].draw(pen)
        glyphs[ch] = {"adv": round(hmtx[gname][0] * scale), "d": pen.d()}
        names[ch] = gname

    by_name = {v: k for k, v in names.items()}
    kern = {}
    for (a, b), v in sorted(kern_table(font, list(names.values()), scale).items()):
        val = round(v * scale)
        if val:
            kern.setdefault(by_name[a], {})[by_name[b]] = val

    atlas = {
        "family": spec["family"],
        "weight": spec["wght"],
        "version": version,
        "copyright": copyright_,
        "license": f"SIL Open Font License 1.1, no Reserved Font Name. Full notice: scripts/fonts/{spec['ofl_out']}",
        "source": spec["url"],
        "unitsPerEm": TARGET_UPM,
        "ascender": round(os2.sTypoAscender * scale),
        "descender": round(os2.sTypoDescender * scale),
        "capHeight": round(os2.sCapHeight * scale),
        "xHeight": round(os2.sxHeight * scale),
        "glyphs": glyphs,
        "kern": kern,
    }
    out = os.path.join(HERE, spec["out"])
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(atlas, fh, ensure_ascii=True, indent=1, sort_keys=False)
        fh.write("\n")
    pairs = sum(len(v) for v in kern.values())
    print(f"wrote {out}: {len(glyphs)} glyphs, {pairs} kerning pairs, {os.path.getsize(out)} bytes")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--cache", help="folder for the downloaded fonts (default: a temp folder)")
    args = ap.parse_args()
    cache = args.cache or tempfile.mkdtemp(prefix="atlas-")
    os.makedirs(cache, exist_ok=True)
    for spec in FONTS:
        build(spec, cache)


if __name__ == "__main__":
    main()
