# DB World UX/UI agent kit

This directory contains the complete `ux-ui-agent-skills` installation used by
Copilot. It is intentionally isolated so the repository's application scripts
remain separate.

Run kit commands from this directory:

```bash
cd .ux-ui-agent-skills
python3 scripts/check_no_emoji.py ../db-world-frontend/src
python3 scripts/lint_hardcodes.py ../db-world-frontend/src
node scripts/verify_mobile_first.mjs ../db-world-frontend/src
```

The kit's tokens, components, accessibility guidance, frameworks, design
systems, workflows, examples, and templates are relative to this directory.
Repository-wide agent instructions remain in `../AGENTS.md`.

Version installed: `3.1.1`.
