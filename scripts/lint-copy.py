#!/usr/bin/env python3
"""Runs Rotem's compliance linter over the visible text of every built page.
Legal documents (privacy, terms) are exempt: they are binding text that must
name Spotify and describe the trial exactly as the app behaves.
    python3 scripts/lint-copy.py [_site]
"""
import html, pathlib, re, subprocess, sys

site = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
lint = pathlib.Path.home() / "levelcast-marketing/system/compliance_lint.py"
project = pathlib.Path.home() / "levelcast-marketing"
EXEMPT = ("privacy/", "terms/")
failed = 0
for page in sorted(site.rglob("*.html")):
    rel = str(page.relative_to(site))
    if any(e in rel for e in EXEMPT):
        continue
    raw = page.read_text(encoding="utf-8")
    raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    text = re.sub(r"\s+", " ", text)
    r = subprocess.run([sys.executable, str(lint), "--project", str(project), "--text", text, "--channel", rel],
                       capture_output=True, text=True)
    bad = [l for l in r.stdout.splitlines() if "**נכשל**" in l]
    if r.returncode:
        failed += 1
        print("FAIL", rel); [print("   ", l) for l in bad]
    else:
        print("ok  ", rel)
sys.exit(1 if failed else 0)
