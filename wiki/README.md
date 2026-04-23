# GRADIENTE FM — Wiki

This is the knowledge base for the `espectro-fm-web` codebase (brand: **GRADIENTE FM**).

It follows [Andrej Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) pattern: a persistent, compounding second brain maintained by an LLM assistant but curated by humans.

## How to use this vault

1. Install [Obsidian](https://obsidian.md) (free).
2. Open this `wiki/` folder as a vault.
3. Start at [[index]] to see the map; [[_schema]] explains the conventions.

If you don't use Obsidian, every file is plain Markdown — open them in VSCode, GitHub's web UI, or any text editor. The `[[wikilinks]]` render as Obsidian links but are readable as plain text elsewhere.

## How this vault is shared

The vault lives inside the repo at `espectro-fm-web/wiki/`. Cloning the repo gets you the wiki. Personal Obsidian workspace files (panel layout, etc.) are gitignored — only shared config and notes are versioned.

This vault **does not ship to the deployed site** — Next.js only bundles code from `/app`, `/components`, `/lib`, `/public`, etc. The `/wiki` folder is source-only.

## Contributing

If you see something that's out of date:
1. Find the note (use Obsidian search or browse [[index]]).
2. Update it.
3. Append a line to [[log]] describing what changed.

Never write content directly in [[index]] or [[log]]. They're the table of contents and the ledger — content goes in dedicated notes.
