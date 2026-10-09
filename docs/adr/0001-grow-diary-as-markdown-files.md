---
Status: accepted
---

# The Grow Diary is stored as markdown files on the Home Assistant filesystem

Each Grow Run's Grow Diary is one markdown file under the Home Assistant config directory (e.g. `growhelper/<run>.md`), not structured data in `.storage/`. Markdown keeps entries human-readable and diffable, and — the deciding reason — it is a format agents can read, append to, and analyze directly, which is what the diary exists for (Plant Health tracking). The accepted trade-off: there is no query layer, so diary analysis is file-based rather than database queries.
