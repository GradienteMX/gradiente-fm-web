---
type: roadmap
status: draft
tags: [roadmap, admin, auth, editor, cms]
updated: 2026-04-22
---

# Admin Dashboard

> A role-gated editor UI at `/admin` for reviewing scraped content, authoring editorials, and managing partners.

## Who uses it

| Role | Access |
|---|---|
| `admin` | Everything — edit any item, manage users, partner CRUD |
| `editor` | Review queue, author editorials/reviews/opinions, adjust vibe/flag on any item, pin hero |
| (nothing) | Public site only — never sees `/admin/*` |

## What editors do here

### 1. Review queue

Scraped items sitting at `published: false`. Filters by source, date, vibe (if scraper guessed).

Per-item actions:
- Set vibe
- Mark `editorial: true`
- Upload better flyer image
- Edit title / subtitle / excerpt / artists / venue
- Write a real editorial take (promote to full editorial piece)
- Discard (never publish)

### 2. Author workflow

Form for creating/editing a content item. Differs by type:

- **Event / mix / partner**: title, subtitle, flyer upload, metadata, vibe slider, genre multi-select, tag multi-select
- **Editorial / review / opinion / noticia**: all the above + `bodyPreview` (teaser) + `body` (full markdown-rendered article) + `author` + `readTime`

All share: `editorial: true`, `pinned: true`, `source` (auto-set to `manual:editor`).

### 3. Pin / hero control

Single-slot pin (see [[Pinned Hero]]). Admin sees current pinned item, can unpin, can pin a different eligible item. UI shows the cadence warning — `SE ACTUALIZA SEMANALMENTE` is a promise.

### 4. Partner management

Separate flow — partners are in the rail, not the grid. Admin adds/edits partner cards with `partnerKind`, `partnerUrl`, `partnerLastUpdated`. Sort position follows `partnerLastUpdated` desc; editor can bump a partner by re-saving.

## Content body — the full article question

`ContentItem` currently has `bodyPreview` (a short multi-paragraph teaser) but no `body` field. For the admin to support full articles, add:

```ts
body?: string          // markdown source
externalUrl?: string   // optional — link to Substack / Ghost / elsewhere
```

Rules:
- If `body` is set → render internally at `/[type]/[slug]` with NGE reader chrome.
- If `externalUrl` is set and `body` is empty → card click opens the external URL (with visible "external link" indicator).
- Both set → internal body wins, `externalUrl` shows as a "first published at" credit.

This lets Shawn Raynaldo's Substack pieces remain at their origin (linked), while staff-written pieces live natively.

## Auth

- **Provider:** Supabase Auth (email/password or magic-link; no social sign-in needed for editor-only role).
- **Storage:** `user_roles` table mapping `user_id` → `role`. RLS policies on `items` gate writes by role.
- **UI gating:** middleware on `/admin/*` redirects unauthenticated → `/login`, unauthorized → `/`.

## URL structure

```
/admin                  dashboard (overview + counts)
/admin/queue            review queue (scraped, unpublished)
/admin/items            all items, filterable by type/status
/admin/items/new        new item form (pick type first)
/admin/items/[id]       edit existing item
/admin/partners         partner rail CRUD
/admin/hero             pinned hero control
/admin/settings         user/role management (admin only)
```

## Dependencies

- [[Supabase Migration]] (DB + auth)
- [[Scraper Pipeline]] (populates the review queue)
- Image upload path (Supabase Storage or R2)

## Open questions

- Do we want a rich-text editor for `body`, or plain markdown? Markdown is simpler, fits the terminal aesthetic, no WYSIWYG bugs. Probably markdown with a live preview.
- Who has `admin` vs just `editor`? Probably datavismo-cmyk (lead) as admin, hzamorate and ikerio as editors.
- Audit log — do we care about tracking who edited what when? Probably yes; Supabase has triggers for this.
- Password reset / team invites — standard flow via Supabase Auth email.

## Links

- [[Scraper Pipeline]]
- [[Supabase Migration]]
- [[Guides Not Gatekeepers]]
- [[Pinned Hero]]
- [[Editorial Flag]]
- [[Content Types]]
