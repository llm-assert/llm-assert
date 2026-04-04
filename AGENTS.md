# AGENTS.md

Cross-cutting principles for the OpenSpec workflow, distilled from 11 skills/commands.
These rules apply whenever an OpenSpec skill or command is invoked (explore, new, continue, apply, ff, sync, archive, bulk-archive, verify, onboard, propose). Individual skills may add stricter constraints; these are the shared baseline.

## Change Selection

- Do NOT guess or auto-select a change when multiple active changes exist — always present options and let the user choose.
- Auto-selection is only permitted when exactly one active change exists; announce "Using change: <name>" and explain how to override before doing any work.
- Never infer which change the user means from context alone when the selection is ambiguous.

(evidence: distilled from 5 skills, 2026-04-04)

## Intent Capture

- If the user has not described what they want to build, ask an open-ended question before creating any artifact or writing any code.
- Do NOT proceed with any implementation or artifact creation until the user's intent is clear.
- If a change already exists for the described goal, surface it and ask whether to continue it or create a new one rather than silently duplicating work.

(evidence: distilled from 2 skills, 2026-04-04)

## Artifact Authoring

- Always read all dependency artifacts before writing a new one in the sequence.
- Create exactly ONE artifact per invocation when in step-through mode (continue-change); never batch-create unless explicitly in ff-change or propose mode.
- Never skip an artifact or create them out of order — the sequence is a contract.
- Verify each artifact file exists on disk after writing it before proceeding to the next.
- Do NOT copy `<context>`, `<rules>`, or `<project_context>` blocks from CLI output into artifact file content; those are agent constraints, not file content.
- Use TodoWrite to track progress when creating multiple artifacts in a single invocation (ff-change, propose).

(evidence: distilled from 3 skills, 2026-04-04)

## Implementation Discipline

- Pause and surface blockers, errors, or unclear requirements to the user rather than guessing. For minor ambiguities, prefer a reasonable decision and note the assumption.
- Keep code changes minimal and scoped to the current task; do not speculatively implement future tasks.
- Update each task's checkbox immediately after completing it — do not batch-update at the end of a session.
- Use `contextFiles` supplied by CLI output; do not assume specific file names or paths.
- If implementation reveals a design issue in the artifacts, propose an artifact update rather than working around the issue in code.

(evidence: distilled from 2 skills, 2026-04-04)

## Mode Boundaries

- In explore mode: never write application code or modify source files. Creating or updating OpenSpec artifacts (proposal, spec, design, tasks) is permitted.
- In apply-change mode: changes must be confined to source code and task-checkbox updates (`- [ ]` to `- [x]` in tasks.md). Do not rewrite artifact prose (proposal, design, specs) — propose an artifact update instead.
- Respect mode boundaries even if the user casually requests a quick implementation during exploration; redirect to the appropriate mode instead.

(evidence: distilled from 2 skills, 2026-04-04)
