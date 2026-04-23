# _schema.md — Vault conventions

> Based on [Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).
> The wiki is a **persistent, compounding artifact** — not a one-shot dump.
> LLMs handle bookkeeping (summarization, cross-refs, filing, consistency);
> humans curate sources, direct questions, and think.

## The three layers

| Layer | Where it lives | Who writes it |
|---|---|---|
| **Raw sources** | `/app`, `/components`, `/lib`, `/context`, commits, issues, PRs, Slack/DMs, voice notes | humans + git |
| **The wiki** | this folder (`/wiki`) | LLM assisted, human curated |
| **The schema** | this file (`_schema.md`) + [[index]] + [[log]] | human |

## The three operations

- **Ingest** — read a source (a PR, a file, a conversation, a design decision) → update the relevant wiki page(s), refresh cross-refs, append to [[log]].
- **Query** — ask a question → retrieve relevant pages → synthesize an answer with `[[wikilinks]]` as citations.
- **Lint** — periodic health check: orphans, contradictions, stale claims, missing back-links, dead file refs.

## Folder map

```
wiki/
├── _schema.md          this file
├── index.md            content-oriented catalog (the map of the wiki)
├── log.md              append-only record of ingests / queries / lints
│
├── 10-Architecture/    stack, data flow, folder patterns, app router conventions
├── 20-Domain/          the conceptual model: vibe spectrum, HP system, content types
├── 30-Pages/           one note per page in /app
├── 40-Components/      one note per significant component in /components
├── 50-Modules/         one note per file in /lib and /context
├── 60-Design/          aesthetics, typography, color, copy voice
├── 70-Roadmap/         future ideas: HTML-on-canvas, gamification, Supabase, etc.
├── 80-External/        FASCINOMA, Club Japan, other ecosystem pieces
└── 90-Decisions/       ADR-style: why a choice was made, what was rejected
```

Numeric prefixes keep the sidebar ordered. Keep folders flat — don't nest deeper than one level.

## File conventions

- **Names:** `Title Case with Spaces.md`. Obsidian resolves `[[wikilinks]]` by filename.
- **Frontmatter:** yaml block at the top of every note:
  ```yaml
  ---
  type: architecture | domain | page | component | module | design | roadmap | external | decision | meta
  status: stub | draft | current | stale
  tags: [a, b, c]
  updated: 2026-04-22
  ---
  ```
- **First line after frontmatter:** H1 matching the filename.
- **Cross-references:** use `[[Note Name]]` aggressively — it's how the graph gets value.
- **Code references:** use markdown links `[filename.tsx:42](../../path/to/file.tsx)` **relative to the wiki file's location** so the link works inside Obsidian and on GitHub.
- **Length:** one concept per note. Split when a note grows past ~400 lines or covers multiple concepts.

## Note anatomy

```markdown
---
frontmatter
---

# Note Title

> One-line what-this-is (shows up in previews).

## What
Plain description. What is this thing?

## Why
The reasoning. What problem does it solve? What alternatives were rejected?

## How
Mechanics. Code pointers. Concrete examples.

## Links
- [[Related Note 1]]
- [[Related Note 2]]

## Open questions
- …
```

Not every section is required — skip what's empty. But keep the headings consistent across notes of the same `type`.

## The two "always" rules

1. **Update [[index]]** when you add or rename a note.
2. **Append to [[log]]** when you do an ingest, query, or lint pass.

Without these, the wiki degrades into a pile of orphans.

## Lint checklist (run occasionally)

- [ ] Every note has frontmatter with `type`, `status`, `updated`
- [ ] No broken `[[wikilinks]]` (Obsidian shows these in red)
- [ ] No orphan notes (open graph view; zero-connection notes are suspect)
- [ ] Code path references resolve (the linked file still exists)
- [ ] [[index]] mentions every note
- [ ] `status: stale` notes either refreshed or archived

## Status glossary

- **stub** — skeleton only, placeholder for future work
- **draft** — substantive but unreviewed
- **current** — reflects the code/decision as it stands
- **stale** — known to be outdated; needs a refresh pass
