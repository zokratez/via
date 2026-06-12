# Sync Protocol

This is the standing protocol for keeping Codex, Claude, Atlas, Linear, Obsidian, and GitHub correlated across PACO work.

## Single Source Per Domain

- Strategy, specs, and lessons live in the PACO Build Playbook in Linear. Claude owns that domain.
- Technical and code truth lives in repo `docs/`. Codex owns that domain.
- Research digestion and durable strategy memory live in Obsidian/Atlas.
- Implementation proof lives in GitHub commits, PRs, checks, and deploys.
- No agent edits another domain silently.

## Sync Is Automatic, Not Requested

- At the end of every Codex work session, Codex appends new technical lessons to `docs/CODEX_LOG.md`, one line each: what broke, what fixed it, and the rule going forward.
- At the start of every Codex session, Codex reads relevant repo docs/checklists before coding.
- When Sam says "sync playbook," Codex mirrors the latest technical lessons Claude has flagged into repo `docs/`.

## Milestone Rule

- Every milestone writes to both memory layers: Claude updates the Linear playbook, and Codex mirrors the technical half into repo `docs/` in the same session.
- A lesson that lives in only one place is considered not captured.

## Tool And Spend Registry Rule

- Any new account, API key, vendor, subscription, or recurring spend must update the Obsidian registry and flag the Linear registry in the same session.
- Obsidian registry: `/Users/samoteo/ooabisabi-memory/tools-registry.md`.
- Linear registry: `ooabi Tool & Service Registry`.
- Store names, env var names, locations, owners, and spend rails only. Never store secret values.
- A tool in only one memory is not captured.

## Marketing Intake Rule

- Marketing dumps live in two inboxes:
  - Linear `Marketing Inbox`, which Claude reads and turns into strategy/issues.
  - Atlas intake folder `/Users/samoteo/Code/atlas/vault/05-intake`, which Atlas analyzes.
- Highlights and validated learnings mirror to Obsidian.
- Folder, Telegram, and Hermes-session intake should all create durable notes, not analyze-and-forget.
