#!/usr/bin/env python3
"""One-shot tool: fetch Google Fonts woff2 files and rewrite the CSS to local paths.

Run from the repo root:  python3 tools/fetch-fonts.py
Output: assets/fonts/*.woff2 and assets/fonts/fonts.css
"""
import os
import re
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "fonts")

# family -> (css2 query, wanted subsets)
FAMILIES = [
    ("Archivo", "Archivo:wdth,wght@62..125,100..900", {"latin", "latin-ext"}),
    ("InstrumentSerif", "Instrument+Serif:ital@1", {"latin", "latin-ext"}),
    ("Inter", "Inter:wght@100..900", {"latin", "latin-ext"}),
    ("GeistMono", "Geist+Mono:wght@100..900", {"latin", "latin-ext"}),
    ("NotoSansDevanagari", "Noto+Sans+Devanagari:wght@100..900", {"devanagari", "latin"}),
]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def slug(name):
    return name.lower()


def main():
    os.makedirs(OUT, exist_ok=True)
    css_out = ["/* Self-hosted webfonts. Archivo, Instrument Serif, Geist Mono, Inter, Noto Sans Devanagari",
               "   are licensed under the SIL Open Font License 1.1. */", ""]
    seen = set()

    for label, query, wanted in FAMILIES:
        url = f"https://fonts.googleapis.com/css2?family={query}&display=swap"
        css = get(url).decode("utf-8")
        blocks = re.findall(r"/\*\s*([\w\-\[\]]+)\s*\*/\s*(@font-face\s*\{.*?\})", css, re.S)
        for subset, block in blocks:
            if subset not in wanted:
                continue
            m = re.search(r"url\((https://[^)]+\.woff2)\)", block)
            if not m:
                continue
            src = m.group(1)
            fname = f"{slug(label)}-{subset}.woff2"
            if fname not in seen:
                path = os.path.join(OUT, fname)
                if not os.path.exists(path):
                    data = get(src)
                    with open(path, "wb") as f:
                        f.write(data)
                    print(f"  saved {fname} ({len(data)//1024} KB)")
                seen.add(fname)
            block = block.replace(src, f"./{fname}")
            css_out.append(f"/* {label} — {subset} */")
            css_out.append(block)
            css_out.append("")

    with open(os.path.join(OUT, "fonts.css"), "w", encoding="utf-8") as f:
        f.write("\n".join(css_out))
    print(f"wrote {os.path.join(OUT, 'fonts.css')} ({len(css_out)} lines)")


if __name__ == "__main__":
    main()
