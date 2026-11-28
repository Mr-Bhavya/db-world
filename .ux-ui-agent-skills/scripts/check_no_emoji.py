#!/usr/bin/env python3
"""Fail if any emoji / decorative pictograph appears in UI output, the taste doctrine,
or the agent's own instruction surface.

The kit forbids emoji in product UI (taste/design-taste.md); this enforces it so it
can't drift back. It also scans the files the AGENT reads on every run (CLAUDE.md,
the skills, component/workflow/content/accessibility specs): if those contain emoji,
the model imitates them and emits emoji-laden output. Keeping the instruction surface
emoji-free is what actually stops emoji in generated design systems.

The em dash and the en dash are banned on the same grounds: they are the most
common tell of machine-written text. They are checked in every file this scans,
and with no arguments in every text file the repository tracks, README and the
scripts included. What is exempt is listed in DASH_EXEMPT, each with its reason.

Usage:
  python3 scripts/check_no_emoji.py                      # emoji: examples/ + taste/ + agent files
                                                         # dashes: every tracked text file
  python3 scripts/check_no_emoji.py path/to/src ...      # both, in these paths
Exit 0 = clean, 1 = an emoji, pictograph or dash was found.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Scan product UI (examples), the taste doctrine, AND the agent's instruction surface:
# the files the model loads and imitates. README is marketing/branding and is excluded.
DEFAULT = [
    ROOT / "examples", ROOT / "taste",
    ROOT / "CLAUDE.md", ROOT / "CONTEXT.md",
    ROOT / ".claude" / "skills", ROOT / ".claude" / "rules", ROOT / ".claude" / "commands",
    ROOT / ".claude" / "agents", ROOT / "evals", ROOT / "templates",
    ROOT / "components", ROOT / "workflows", ROOT / "content",
    ROOT / "accessibility", ROOT / "frameworks",
    ROOT / "design-systems",
]
EXTS = {".md", ".mdx", ".html", ".htm", ".tsx", ".jsx", ".ts", ".js",
        ".vue", ".svelte", ".css", ".scss", ".astro", ".json"}

# Emoji + dingbat pictographs (check marks, stars, etc.). Deliberately EXCLUDES
# arrows (U+2190-21FF) and box-drawing, which are legitimate typographic notation.
# Ranges are referenced by codepoint only (this file stays emoji-free itself).
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF"   # symbols & pictographs, emoticons, transport, supplemental
    "\U00002600-\U000026FF"    # misc symbols
    "\U00002700-\U000027BF"    # dingbats (check marks, stars, scissors, ...)
    "\U00002B00-\U00002BFF"    # misc symbols & arrow pictographs (star, ...)
    "\U0001FA70-\U0001FAFF"
    "\U0000FE0F\U000020E3]"    # variation selector + combining keycap
)


def iter_files(paths):
    for p in paths:
        pp = Path(p)
        if pp.is_dir():
            for f in pp.rglob("*"):
                if f.suffix in EXTS and "node_modules" not in f.parts:
                    yield f
        elif pp.is_file():
            yield pp


DASH = re.compile("[\u2014\u2013]")  # em dash / en dash: an AI-pattern tell

# Not the kit's own writing, so not the kit's to rewrite.
DASH_EXEMPT = (
    "design-systems/library/",    # measured third-party specs, imported as published
    "design-systems/library.json",  # generated from those specs
    "design-systems/catalog.md",    # generated from those specs
    "evals/out/",                 # a blind run's output, kept unedited as the record
    "tests/fixtures/bad/slop-screen.html",  # the slop under test: the dash is the defect
)
BINARY = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2",
          ".ttf", ".otf", ".pdf", ".gz", ".tgz", ".zip"}


def tracked_text_files():
    """Every text file git tracks, or every file under the root without git."""
    try:
        out = subprocess.run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=ROOT, capture_output=True,
                             check=True).stdout.decode("utf-8")
        rels = [r for r in out.split("\0") if r]
    except (OSError, subprocess.CalledProcessError):
        rels = [f.relative_to(ROOT).as_posix() for f in ROOT.rglob("*")
                if f.is_file() and not {"node_modules", ".git"} & set(f.parts)]
    for rel in rels:
        if rel.startswith(DASH_EXEMPT) or Path(rel).suffix.lower() in BINARY:
            continue
        yield ROOT / rel


def exempt(f):
    try:
        rel = f.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return False  # outside the kit: a user's project, checked in full
    return rel.startswith(DASH_EXEMPT)


def main(argv):
    explicit = [Path(a) for a in argv]
    paths = explicit or DEFAULT
    # A path that is not there scans nothing and used to print OK, so a renamed
    # directory in CI would pass silently. Green has to mean "looked and found none".
    missing = [p for p in explicit if not p.exists()]
    if missing:
        print("ERROR: path(s) not found: " + ", ".join(str(m) for m in missing))
        return 1
    hits = []
    files = list(iter_files(paths))
    if explicit and not files:
        print(f"ERROR: no scannable file(s) under {', '.join(str(p) for p in explicit)}")
        return 1
    dash_files = files if explicit else list(tracked_text_files())
    for f in files:
        for n, line in lines(f):
            for m in EMOJI.finditer(line):
                hits.append(f"{f}:{n}: emoji/pictograph {m.group(0)!r} - use lucide / plain text")
    for f in dash_files:
        if exempt(f):
            continue
        for n, line in lines(f):
            for m in DASH.finditer(line):
                hits.append(f"{f}:{n}: em/en-dash {m.group(0)!r} - AI-pattern tell; use a period, comma, colon or parentheses")
    if explicit:
        print(f"Scanned {len(files)} file(s).")
    else:
        print(f"Scanned {len(files)} file(s) for emoji, {len(dash_files)} for dashes.")
    if hits:
        print(f"\nFAIL: {len(hits)} emoji, pictograph(s) or dash(es) found:")
        for h in hits:
            print("  x " + h)
        return 1
    print("OK: no emoji in UI output or taste files, and no em or en dash.")
    return 0


def lines(f):
    try:
        return enumerate(f.read_text(encoding="utf-8").splitlines(), 1)
    except (UnicodeDecodeError, OSError):
        return enumerate([], 1)


if __name__ == "__main__":
    # Findings quote what they found (an arrow, an emoji, a Thai name), and a
    # Windows console in a legacy code page cannot print it.
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv[1:]))
