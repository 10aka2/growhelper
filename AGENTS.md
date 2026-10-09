## Agent skills

### Issue tracker

Issues and PRDs for this addon live as GitHub issues, operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles map 1:1 to label strings of the same name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Coding standards

All code in this repository is written to be read by humans first:

- **Well documented and commented** — every module, class, and non-trivial function explains what it does and why, not just how.
- **Understandable naming** — names follow the domain language in `CONTEXT.md` (Grow Box, Grow Run, Plant, Growth Phase, Target Profile, …). No abbreviations that are not in the glossary.
- **Maintainable structure** — short functions, single responsibilities, no dead code; clarity over cleverness.
- **Language** — code, comments, and docs in English (Home Assistant conventions); user-facing UI strings in German, matching the existing dashboard.
