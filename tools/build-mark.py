#!/usr/bin/env python3
"""Generate the ContribMark "overlap lens" mark in every required version.

The mark is two overlapping circles — a large one in ink, a smaller one in
charcoal — with the intersection lens filled in the accent colour. Circle sizes
and tones differ so it never reads as a default Venn diagram or a Mastercard
style pair of equal discs.

Outputs:
  assets/logo/mark.svg        colour (light background)
  assets/logo/mark-mono.svg   pure black & white, lens knocked out
  assets/logo/mark-dark.svg   for dark backgrounds
  assets/logo/favicon.svg     simplified, bold, holds at 16px
  assets/logo/lens-path.json  the exact lens outline, reused by the mascot

Usage: python3 tools/build-mark.py
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "logo")

# Geometry (32x32 viewBox)
CX_A, CY_A, R_A = 11.5, 11.5, 9.0     # ink disc
CX_B, CY_B, R_B = 20.5, 20.5, 7.5     # charcoal disc


def circle_intersection(ax, ay, r1, bx, by, r2):
    """Return the two intersection points of two circles, in SVG (y-down) space."""
    dx, dy = bx - ax, by - ay
    d = math.hypot(dx, dy)
    a = (d * d + r1 * r1 - r2 * r2) / (2 * d)
    h = math.sqrt(max(r1 * r1 - a * a, 0.0))
    xm = ax + a * dx / d
    ym = ay + a * dy / d
    rx, ry = -dy / d * h, dx / d * h
    return (xm + rx, ym + ry), (xm - rx, ym - ry)


def lens_path():
    """SVG path for the intersection lens (the accent signature shape)."""
    p1, p2 = circle_intersection(CX_A, CY_A, R_A, CX_B, CY_B, R_B)
    # Arc of circle A between the two points (the part inside B), then arc of B.
    def arc_to(cx, cy, r, p_from, p_to, sweep):
        # We use A rx ry rot large-arc sweep x y; large-arc = 0 because the lens
        # arc is always the minor arc on each circle.
        return (f"A {r} {r} 0 0 {sweep} {p_to[0]:.3f} {p_to[1]:.3f}")

    # Determine sweep flags empirically by testing the arc midpoint.
    def mid_on_arc(cx, cy, r, p_from, p_to, sweep):
        # Approximate midpoint of the chosen arc via angular interpolation.
        a1 = math.atan2(p_from[1] - cy, p_from[0] - cx)
        a2 = math.atan2(p_to[1] - cy, p_to[0] - cx)
        if sweep == 1:
            while a2 <= a1:
                a2 += 2 * math.pi
        else:
            while a2 >= a1:
                a2 -= 2 * math.pi
        am = (a1 + a2) / 2
        return (cx + r * math.cos(am), cy + r * math.sin(am))

    # Lens boundary: start at p1, arc along B (inner arc) to p2, arc along A back to p1.
    def inside(pt, cx, cy, r):
        return math.hypot(pt[0] - cx, pt[1] - cy) <= r + 1e-9

    # p1 on A (outer side), p2 is the other. Walk from p1 to p2 using circle B's
    # arc that stays inside A, and circle A's arc that stays inside B.
    sweep_b = 1 if inside(mid_on_arc(CX_B, CY_B, R_B, p1, p2, 1), CX_A, CY_A, R_A) else 0
    sweep_a = 1 if inside(mid_on_arc(CX_A, CY_A, R_A, p2, p1, 1), CX_B, CY_B, R_B) else 0

    d = f"M {p1[0]:.3f} {p1[1]:.3f} "
    d += f"A {R_B} {R_B} 0 0 {sweep_b} {p2[0]:.3f} {p2[1]:.3f} "
    d += f"A {R_A} {R_A} 0 0 {sweep_a} {p1[0]:.3f} {p1[1]:.3f} Z"
    return d, p1, p2


def mark_svg(bg, ink, charcoal, accent, lens_fill, extra=""):
    d, _, _ = lens_path()
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" role="img" aria-label="ContribMatch">
  <title>ContribMatch</title>
  <defs>
    <clipPath id="cm-lens-clip">
      <circle cx="{CX_B}" cy="{CY_B}" r="{R_B}"/>
    </clipPath>
  </defs>
  <circle cx="{CX_A}" cy="{CY_A}" r="{R_A}" fill="{ink}"/>
  <circle cx="{CX_B}" cy="{CY_B}" r="{R_B}" fill="{charcoal}"/>
  <circle cx="{CX_A}" cy="{CY_A}" r="{R_A}" fill="{lens_fill}" clip-path="url(#cm-lens-clip)"/>{extra}
</svg>
"""


def favicon_svg():
    """16px-friendly simplification: chunkier discs, lens large and flat."""
    d, _, _ = lens_path()
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" role="img" aria-label="ContribMatch">
  <title>ContribMatch</title>
  <defs>
    <clipPath id="cm-fav-clip">
      <circle cx="20" cy="20" r="8"/>
    </clipPath>
  </defs>
  <circle cx="11" cy="11" r="10" fill="#15171B"/>
  <circle cx="20" cy="20" r="8" fill="#4B525C"/>
  <circle cx="11" cy="11" r="10" fill="#2D81FF" clip-path="url(#cm-fav-clip)"/>
</svg>
"""


def main():
    os.makedirs(OUT, exist_ok=True)
    d, p1, p2 = lens_path()

    with open(os.path.join(OUT, "mark.svg"), "w", encoding="utf-8") as f:
        f.write(mark_svg("", "#15171B", "#4B525C", "#2D81FF", "#2D81FF"))
    with open(os.path.join(OUT, "mark-mono.svg"), "w", encoding="utf-8") as f:
        # Pure black and white: both discs black, lens knocked out in white.
        f.write(mark_svg("", "#000000", "#000000", "#2D81FF", "#FFFFFF"))
    with open(os.path.join(OUT, "mark-dark.svg"), "w", encoding="utf-8") as f:
        f.write(mark_svg("", "#F2F0EA", "#7C8492", "#2D81FF", "#2D81FF"))
    with open(os.path.join(OUT, "favicon.svg"), "w", encoding="utf-8") as f:
        f.write(favicon_svg())

    with open(os.path.join(OUT, "lens-path.json"), "w", encoding="utf-8") as f:
        json.dump({"d": d, "points": [p1, p2]}, f, indent=2)

    print("mark.svg / mark-mono.svg / mark-dark.svg / favicon.svg written")
    print(f"lens path: {d}")
    print(f"lens points: {p1} {p2}")


if __name__ == "__main__":
    main()
