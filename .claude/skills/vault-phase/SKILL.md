---
name: vault-phase
description: Run one phase of the vault roadmap (docs/superpowers/plans/2026-10-24-vault-roadmap.md) in its own session, on the model that phase calls for. Usage - /vault-phase <0-5>
---

## Run a vault roadmap phase on the right model

The argument is a phase number, 0 to 5. The plan is
`docs/superpowers/plans/2026-10-24-vault-roadmap.md`. Read its "Model per task", "Decisions",
"Global Constraints" and the phase's section before doing anything else.

### 1. Pick the model

| Phase | Model id |
|---|---|
| 0 | `claude-haiku-5-5` for 0.1, `claude-opus-5-5` for 0.2 (start Opus: 0.1 is done) |
| 1 | `claude-sonnet-5-5` |
| 2 | `claude-opus-5-5` |
| 3 | `claude-sonnet-5-5`; Task 3.4 alone on `claude-opus-5-5` (start it as its own session) |
| 4 | `claude-opus-5-5` |
| 5 | `claude-opus-5-5` (`claude-fable-5-1` for the 5.1 spike if the model picker offers it) |

If the argument is missing or not 0-5, say so and stop.

### 2. Check it can start

- **Model.** A session can start another only on its own model family or a cheaper one; a more
  expensive model is silently ignored. If the phase's model is more expensive than this session's,
  STOP and tell the user: "Phase N needs <model>. Switch this session to it in the model menu
  (or run `/model <id>`), then run `/vault-phase N` again." Do not start a session on a cheaper
  model than the phase asks for.
- **One writer at a time.** The phase sessions share this checkout and commit to `development`.
  Call `mcp__ccd_session_mgmt__list_sessions` with `{"linked": true}`; if a session whose name
  starts with `vault-phase-` is running or starting, STOP and say which one is still working.
- **Order.** Phase N needs every earlier phase's tasks ticked (`- [x]`) in the plan, except that
  Phases 1 and 3 may run while 4.0 (the Android spike) is open, and Task 0.2 must be done before
  Phase 2. If an earlier phase is not done, say which tasks are open and ask before starting.
- **Clean tree.** `git status --short` must show nothing but `.claude/settings.local.json`;
  otherwise list the files and ask the user what to do with them.

### 3. Start it

Call `mcp__ccd_session__start_session` with:

- `initiation`: `"user_asked"`
- `context`: `"fresh"`
- `use_worktree`: `false` (work happens on `development` in this checkout, as the plan says)
- `model`: the id from step 1
- `name`: `vault-phase-N`
- `title`: `Vault roadmap: Phase N`
- `prompt`: "Execute Phase N of docs/superpowers/plans/2026-10-24-vault-roadmap.md with the
  superpowers:subagent-driven-development skill, task by task. Work on the `development` branch in
  this checkout; one commit per task, no Co-Authored-By trailer, never push. Tick each task's
  checkboxes in the plan as it is done and commit the plan with it. Stop and ask the user when a
  step needs a device, a secret, a production action or a decision the plan leaves open. Finish
  with a short report: tasks done, tests run with their results, anything not verified."
- `background`: "db-world is a Spring Boot 4 / Java 25 backend (db-world-backend) and a React 18 +
  MUI 7 + Capacitor Android frontend (db-world-frontend). The vault roadmap was agreed with the
  user on 2026-10-24; its Decisions and Global Constraints sections are binding (Flyway V<n>
  migrations safe on fresh and existing databases, MapStruct, useT() inside components, never
  regenerate package-lock.json on Windows). Maven path is in CLAUDE.md."

Then tell the user, in one or two lines, which session started (link it as `[title](#local_<id>)`)
and on which model.
