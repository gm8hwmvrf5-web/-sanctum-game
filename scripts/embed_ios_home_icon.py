#!/usr/bin/env python3
"""Embed the EXISTING Sanctum PNG directly in the published HTML for iOS 27.

Recent iOS 27 builds can show a monogram for web apps when apple-touch-icon
requires a separate network request. Keep branch/index.html with a normal URL
for local tests, but publish an inline PNG data URI on GitHub Pages so the
Home Screen sheet does not have to fetch that icon.
"""
import base64
import pathlib
import re
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: embed_ios_home_icon.py <published-index> <original-icon-180.png>")
html_path, icon_path = map(pathlib.Path, sys.argv[1:])
source = icon_path.read_bytes()
if source[:8] != b"\x89PNG\r\n\x1a\n":
    raise SystemExit("Sanctum apple-touch-icon is not a PNG")
if (int.from_bytes(source[16:20], "big"), int.from_bytes(source[20:24], "big")) != (180, 180):
    raise SystemExit("Sanctum Apple touch icon must be 180x180 PNG")

html = html_path.read_text(encoding="utf-8")
pattern = re.compile(r'(<link rel="apple-touch-icon" sizes="180x180" href=")([^"]+)(" */>)')
matches = list(pattern.finditer(html))
if len(matches) != 1 or matches[0].group(2) != "./sanctum-iphone-icon-v101.png":
    raise SystemExit("Expected exactly one iPhone icon link with the original file-based href")

uri = "data:image/png;base64," + base64.b64encode(source).decode("ascii")
html = pattern.sub(lambda m: m.group(1) + uri + m.group(3), html, count=1)
html_path.write_text(html, encoding="utf-8")

# Verify the published icon bytes really are IDENTICAL to the original.
match = pattern.search(html_path.read_text(encoding="utf-8"))
if not match or not match.group(2).startswith("data:image/png;base64,"):
    raise SystemExit("Missing inline iOS icon in published HTML")
if base64.b64decode(match.group(2).split(",", 1)[1], validate=True) != source:
    raise SystemExit("Published inline icon differs from the original artwork")
if 'rel="apple-touch-icon-precomposed"' in html:
    raise SystemExit("Second conflicting Apple icon link exists")
print(f"PASS: Inlined original Sanctum 180x180 PNG ({len(source)} bytes) for iOS Home Screen")
