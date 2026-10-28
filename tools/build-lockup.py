#!/usr/bin/env python3
"""Build the ContribMatch horizontal lockup SVG with REAL outlined glyph paths.

Reads the self-hosted woff2 fonts (converted to TTF on the fly), shapes the
wordmark with HarfBuzz so kerning/advance widths are correct, and emits SVG
path data for every glyph using fontTools' SVGPathPen. The result is a
standalone SVG that renders identically with or without webfonts installed.

Usage: python3 tools/build-lockup.py
"""
import os
import tempfile

import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "assets", "fonts")
OUTDIR = os.path.join(ROOT, "assets", "logo")


def woff2_to_ttf(src, dest):
    f = TTFont(src, fontNumber=0)
    f.flavor = None
    f.save(dest)
    return dest


def instance_variable(src_ttf, dest_ttf, axis=None, value=None):
    if axis is None:
        return src_ttf
    f = TTFont(src_ttf)
    if "fvar" not in f:
        return src_ttf
    loc = {a.axisTag: value for a in f["fvar"].axes if a.axisTag == axis}
    if not loc:
        return src_ttf
    instancer.instantiateVariableFont(f, loc, inplace=True)
    f.save(dest_ttf)
    return dest_ttf


def glyph_paths(font_ttf):
    """Return {glyph_name: svg_path_d} for every glyph in the font."""
    f = TTFont(font_ttf)
    glyph_set = f.getGlyphSet()
    order = f.getGlyphOrder()
    out = {}
    for name in order:
        pen = SVGPathPen(glyph_set)
        try:
            glyph_set[name].draw(pen)
        except Exception:
            continue
        out[name] = pen.getCommands()
    upem = f["head"].unitsPerEm
    return out, order, upem


def shape(font_bytes, text, upem):
    """Return [(glyph_name, x_offset)] shaped with HarfBuzz, plus total advance."""
    face = hb.Face(font_bytes)
    font = hb.Font(face)
    font.scale = (upem, upem)
    hb.ot_font_set_funcs(font)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf)

    from fontTools.ttLib import TTFont as _TF
    return buf.glyph_infos, buf.glyph_positions


def build():
    tmp = tempfile.mkdtemp()
    archivo_ttf = woff2_to_ttf(os.path.join(FONTS, "archivo-latin.woff2"),
                               os.path.join(tmp, "archivo.ttf"))
    archivo_ttf = instance_variable(archivo_ttf, os.path.join(tmp, "archivo-800.ttf"),
                                    axis="wght", value=800)
    inst_ttf = woff2_to_ttf(os.path.join(FONTS, "instrumentserif-latin.woff2"),
                            os.path.join(tmp, "instrument.ttf"))

    a_paths, a_order, a_upem = glyph_paths(archivo_ttf)
    i_paths, i_order, i_upem = glyph_paths(inst_ttf)

    with open(archivo_ttf, "rb") as f:
        a_bytes = f.read()
    with open(inst_ttf, "rb") as f:
        i_bytes = f.read()

    def run(font_bytes, order, paths, text, upem):
        infos, positions = shape(font_bytes, text, upem)
        x = 0
        out = []
        for info, pos in zip(infos, positions):
            name = order[info.codepoint] if info.codepoint < len(order) else None
            if name and paths.get(name):
                out.append((paths[name], x))
            x += pos.x_advance
        return out, x

    contrib, contrib_w = run(a_bytes, a_order, a_paths, "Contrib", a_upem)
    match, match_w = run(i_bytes, i_order, i_paths, "Match", i_upem)
    return contrib, contrib_w, match, match_w, a_upem


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    contrib, contrib_w, match, match_w, upem = build()
    scale = 1.0 / upem

    gap = 0.05 * upem          # optical space between words
    cap = 0.72 * upem          # Archivo cap height
    baseline = cap + 0.06 * upem
    height = baseline + 0.06 * upem
    total_w = contrib_w + gap + match_w

    def group(items, dx, dy):
        """dx/dy are in font units; the emitted transform works in viewBox units."""
        parts = []
        for d, x in items:
            tx = (dx + x) * scale
            ty = dy * scale
            parts.append(
                f'    <path d="{d}" transform="translate({tx:.4f} {ty:.4f}) '
                f'scale({scale:.6f} {-scale:.6f})"/>')
        return "\n".join(parts)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_w*scale:.4f} {height*scale:.4f}" width="{total_w*scale:.0f}" height="{height*scale:.0f}" role="img" aria-labelledby="cmTitle">
  <title id="cmTitle">ContribMatch</title>
  <g fill="currentColor" fill-rule="nonzero">
{group(contrib, 0, baseline)}
{group(match, contrib_w + gap, baseline)}
  </g>
</svg>
"""
    with open(os.path.join(OUTDIR, "wordmark.svg"), "w", encoding="utf-8") as f:
        f.write(svg)
    print("wordmark.svg written")
    print(f"  Contrib advance={contrib_w}  Match advance={match_w}  upem={upem}")
    print(f"  contrib glyphs={len(contrib)}  match glyphs={len(match)}")


if __name__ == "__main__":
    main()
