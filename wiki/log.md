# log.md

> Append-only. Newest at top. Every ingest / query / lint pass gets a line.
>
> Format: `YYYY-MM-DD · OP · short description · [[links]]`
>
> Operations: `INGEST` (source → wiki), `QUERY` (wiki → answer), `LINT` (vault health).

---

## 2026-04-26 · INGEST · Foro (imageboard-style discussion)

A new top-level destination at `/foro` — imageboard-style threaded discussion, kept fully isolated from the curated content grid. Threads aren't `ContentItem`s, never enter the home feed, never get HP/curation scoring. See [[Foro]] for the full route doc.

**Catalog rules.** Bump-order desc, hard cap at 30 visible threads (`FORO_THREAD_CAP`). New threads bump to top; new replies bump their parent. No likes, no reactions, no engagement scoring — reply count is the only ranking signal allowed (consistent with [[Size and Position as Only Signals]] / [[No Algorithm]]). The [[VibeSlider]] reappears on /foro and filters threads via genre intersection (`genresIntersectVibeRange` in [[genres]]).

**Thread model.** New `ForoThread` and `ForoReply` types in [[types]]. Threads require `subject`, `body`, `imageUrl` (mandatory on OP), `genres: string[]` (1–5 enforced via `FORO_THREAD_GENRES_MIN/MAX`), `createdAt`, `bumpedAt`. Replies are flat (no nesting), with optional image and `quotedReplyIds: string[]` parsed from `>>id` tokens in the body.

**Storage layer** [[foro]]. `gradiente:foro` sessionStorage with `{ addedThreads, addedReplies, bumpOverrides }`. Mirrors the [[comments]] / [[saves]] idiom — listener-pattern hooks, pure-function writers. `bumpOverrides[mockThreadId] = newBumpedAt` shadows immutable seed thread bumpedAt at read time. `useThreads` / `useThread(id)` / `useReplies(id)` / `useReplyCount(id)` cover the read paths.

**Session id format.** New `newThreadId()` and `newReplyId(threadId)` mirror the mock convention so user-authored ids are visually indistinguishable from seeds in `>>id` quote-tokens. Threads → `fr-s01`, `fr-s02`, … Replies → `fp-{threadShortRef}-s01` (e.g. `fp-003-s05` continues past the 4 mock replies on fr-003). The `s` marker prevents collision if seed numbering is later extended.

**Public-side surfaces:**
- [[ForoCatalog]] — page body. Reads `useThreads()` + `useVibe().vibeRange`, filters via `genresIntersectVibeRange`, mounts the URL-driven thread + compose overlays (`?thread=` / `?compose=`). Empty states differentiate "no threads at all" from "filtered out by vibe".
- [[ThreadTile]] — image-forward tile. R·NN reply-count chip top-left, SESIÓN chip top-right when session-authored, `//FR-XXX` id chip bottom-left. First 2 genres + `+N` overflow chip. Whole tile is a `<Link href="/foro?thread=…">`.
- [[ThreadOverlay]] — modal. Builds `inboundIndex: Map<postId, replyId[]>` for backlinks and `authorByPostId` for the inline-quote `TÚ` marker (see below). Image float-left on each post; body parsed for `>>id` tokens which become orange clickable buttons that scroll-and-pulse the target post (`data-postid` lookup, 1.6s outline pulse).
- [[NewThreadOverlay]] — composer. Login required, image required, 1–5 genre picker with vibe-color chips and 6th-rejection error. On submit, atomically swaps `?compose=1` for `?thread=<newId>` so user lands on their thread.
- [[ReplyComposer]] — pinned-bottom in [[ThreadOverlay]]. Login-gated, optional image, `>>id` parsing. Pre-fills with `>>id` quote-back when user clicks a post-id chip (composer remounts via `key` bump to apply `initialQuotedIds`).
- [[PostHeader]] — role-colored identity chip + `[TÚ]` when own post + clickable `>>postid` on the right.

**Backlinks.** Under each post header, `respondieron: >>id1 >>id2 …` lists inbound replies (only when there are any — quiet for unanswered posts). Map inverted from `quotedReplyIds` once per replies-change via `useMemo`.

**Inline `[TÚ]` on quote-tokens.** When a `>>id` token in body text resolves to a post authored by the current user, an orange `TÚ` chip renders next to it. Surfaces "someone is replying to me" without forcing the reader to scan the thread for the cited post. Complements PostHeader's existing `[TÚ]` (which marks "this post is mine"). Implementation: `authorByPostId` map in [[ThreadOverlay]], `isQuoteToMe(id)` helper threaded through `PostBody` → `BodyText`.

**Genre + vibe sharing.** `GENRE_VIBE` map (was inlined in [[VibeSlider]]) extracted to [[genres]] as an exported const, alongside new helpers `vibeForGenre` and `genresIntersectVibeRange`. Lets the foro catalog and the slider share the genre→vibe lookup, and any future surface can plug in.

**Navigation.** New `/foro` link at code `07` in [[Navigation]]'s NAV_LINKS, between `/articulos` and the auth badge. Mobile + desktop nav share the same source array.

### Verified in preview

- Catalog renders 8 mock threads with reply counts (R·04, R·03, …) and genre chips colored per `GENRE_VIBE`.
- Click tile → thread overlay opens at `?thread=fr-003`, shows OP + 4 replies with proper role badges (REDACCIÓN/OG/LECTOR/INSIDER), image float, working `>>id` quote-buttons, backlinks under each cited post.
- Logged out → reply composer shows "INICIA SESIÓN PARA RESPONDER"; "+ NUEVO HILO" trigger opens [[LoginOverlay]].
- Logged in as `loma_grave` → posting a thread persists to sessionStorage with id `fr-s01`, lands at position 1 in catalog (counter 08/30 → 09/30), overlay opens automatically.
- Posting a reply on fr-003 (which has 4 mock replies) → id `fp-003-s05`, parent thread bumps to top via `bumpOverrides[fr-003]`.
- Genre picker: 5/5 cap, 6th selection rejected with `Máximo 5 géneros.` error. Submit disabled until subject + body + image + genres ≥ 1.
- Vibe slider drag (max 10 → 3): catalog filters from 8 to 2 threads (fr-006 ambient-techno + fr-008 downtempo/dub), counter swaps to `02/08 EN RANGO`.
- Inline `TÚ` marker: logged in as `tlali.fm`, fp-001-02's body shows `>>fp-001-01` followed by orange `TÚ` chip (her seed reply is being quoted). Negative case verified — switching to `loma_grave` removes the chip in fr-001 and adds it in fr-007 (where her fp-007-01 is quoted by fp-007-02).
- `npm run dev` clean across all changes; no console or server errors after final reload.

### Open follow-ups

- Catalog cap is read-side only (slice 30). Storage can grow past 30 if a user authors many threads in one session; only the catalog is bounded. Real backend will need server-side prune-on-insert.
- No moderation surface yet — no thread/reply tombstone equivalent of [[CommentList]]'s deletion stub. Deferred.
- No per-user keying on session storage (same caveat as [[comments]] / [[saves]]). Real backend keys per user.

---

## 2026-04-26 · INGEST · Save-from-feed flow

Closes the long-deferred Guardados/* slot. Users can now bookmark publications from the public side and review them in the dashboard alongside saved comments.

**Storage layer** [[saves]]. `gradiente:saves` sessionStorage with shape `{ savedIds: string[] }`. Mirrors the [[comments]] store idiom — listener-pattern hooks (`useSavedItems`, `useIsItemSaved`), pure-function writers (`toggleSavedItem`, `clearSavedItems`). Resolver looks in `MOCK_ITEMS` first, falls back to [[drafts]] via `getItemById` so session-published items are saveable too. Items whose ids no longer resolve are silently dropped — no ghost rows when a user deletes a saved draft.

**Public-side affordance:**
- [[SaveItemButton]] — `★ GUARDAR / ★ GUARDADO` chip in the [[OverlayShell]] header, next to [[ShareButton]]. Login-gated, orange-when-active.
- [[SavedBadge]] — tiny orange `★` chip in the top-right corner of every [[ContentCard]] and [[HeroCard]]. Renders `null` when not saved so the unsaved feed has zero added chrome. Distinct from the red editorial-flag mark by both color (orange vs red) and position (top-right vs top-left).

**Dashboard surface.** [[GuardadosSection]] replaces the previous placeholder body. Filter prop generalized from `ContentType | null` to `ContentType[] | null` so the `editoriales` slot covers both `editorial` and `opinion`, and `articulos` covers `articulo` and `listicle` — keeps editorially-related types together rather than fragmenting them. Each tile uses [[DraggableCanvas]] under namespace `saves:<filterKey>` (e.g. `saves:articulos`) so each filter view has its own drag layout. Tile click navigates via `?item=<slug>` to open the overlay; inline `★ QUITAR` button on the thumbnail unsaves without bubbling to the tile click.

**Sidebar wiring.** Dropped `stub: true` from all 7 `Guardados/*` items in [[ExplorerSidebar]]; wired live count badges from `useSavedItems` (with editorial+opinion / articulo+listicle merging) plus the previously-already-real comments count. The dashboard page's hardcoded `savedCount = 0` became `useSavedItems().length` driving the storage panel total.

### Verified in preview

- Login as `loma_grave` → open `?item=festivales-latam-presion-europea-2026` → click `☆ GUARDAR` → flips to `★ GUARDADO`, aria-pressed=true, sessionStorage shows `{"savedIds":["ar-001"]}`.
- Close overlay → home grid → `ar-001`'s card shows the saved star badge with `aria-label="Guardado"` alongside its unrelated red editorial mark.
- `?section=guardados-articulos` → DraggableCanvas with 1 tile (thumbnail + `//ARTICULO` chip + title + inline `★ QUITAR`).
- Sidebar badges live-update: `Artículos: 01`, `Feed: 01`.
- `npm run build` passes; 16 routes prerendered as static content.

### Open follow-ups

- Saves are not user-keyed (same caveat as saved comments) — switching mock users in the same tab shows the previous user's saves. Real backend keys per user.
- The `partner` content type is excluded from saves by design (per [[Partners Isolation]]) — no UI surfaces it for save, no slot in `Guardados/*`.
- Click-vs-drag on saved-item tiles uses `DraggableCanvas`'s 4px threshold, same as saved-comments tiles. QUITAR button uses `e.stopPropagation()` so it doesn't fire the tile's open-overlay click — same isolation pattern.

---

## 2026-04-26 · INGEST · Comments system + saved-comments dashboard

Shipped a full discussion subsystem on top of the overlay layer plus a dashboard surface for saving comments back to user-specific bookmarks. Five surfaces + four library modules + a generic file-canvas primitive.

**Identity rework.** Replaced the binary `admin/insider/null` auth model with a strict role hierarchy `admin ⊃ moderator ⊃ collaborator ⊃ user`, where `user` carries a sub-`userCategory` of `og | insider | normal`. New types in [`lib/types.ts`](../../lib/types.ts): `Role`, `UserCategory`, `User`, `ReactionKind`, `Reaction`, `Comment`, `CommentDeletion`. Real handles for the project team (`datavismo-cmyk` admin, `hzamorate` + `ikerio` collaborators) seeded alongside synthetic personas in [[mockUsers]].

**Auth surface.** [[useAuth]] rewritten to expose `currentUser: User | null` derived from `MOCK_USERS`; storage shape moved from `{ role, username }` to `{ userId }`. Added `loginAs(userId)` for the new picker. [[LoginOverlay]] gained a `QUICK·SWITCH` panel listing all 8 mock users with role badges — log in as any tier without remembering credentials. Existing `admin/admin` shortcut preserved (resolves to canonical admin).

**Permission helpers.** [[permissions]] module — pure functions: `hasRole`, `canComment`, `canReact`, `canEditComment`, `canDeleteOwnComment`, `canModerateComment`, `canEditContent`, `canBanUser`, `canAssignRoles`. Anonymous = read-only. Authors edit only their own comments — admins explicitly cannot edit other users' words.

**Comment data model.** [[mockComments]] — 25 seed comments threaded across `ar-001`, `ed-001`, `mx-001`, `rv-001`. Exercises depth-5 threading, controversy hot-spot (cm-006: high-resonate AND high-disagree, both count toward engagement), moderator tombstone with preserved replies (cm-009), edited marker (cm-011). Helpers `engagementScore`, `descendantCount`, `directReplyCount`.

**Session-scoped overlay store** [[comments]]. `gradiente:comments` sessionStorage holds three slices: `added` (new top-level/reply comments), `reactionOverrides` (per-comment reaction lists that shadow seed data), `savedIds` (bookmarks for the dashboard surface). Hooks `useComments(itemId)`, `useIsCommentSaved(commentId)`, `useSavedComments()` subscribe via a small listener registry. Reaction toggles do not subtract — disagreement counts as engagement, not suppression. See [[No Algorithm]].

**Discussion UI surfaces:**
- [[CommentList]] — threaded renderer with recursive sort (activity → engagement → chronological), depth cap at 4 with `↳ VER N RESPUESTAS MÁS` collapse, role-colored badges (admin orange / moderator red / collaborator green / OG-INSIDER blue-purple / lector neutral), tombstone rendering with deletion reason, "EDITADO" marker.
- [[CommentComposer]] — login-gated dual-variant: `root` (always-expanded textarea pinned at column bottom) and `reply` (collapsed `↳ RESPONDER` trigger that expands inline). Enter posts, shift+enter newline, Esc cancels.
- [[CommentsColumn]] — column chrome (header + status strip + scroll body + composer footer) consuming `useComments(item.id)`.
- ASCII reaction palette `[+]` resonates / `[−]` disagree / `[?]` provocative / `[!]` signal — never emoji. Active state highlights the user's own reactions in orange.
- "TÚ" indicator on user-own comments — orange-tinted left rail + `[TÚ]` chip alongside the role badge.

**Split-screen overlay layout** in [[OverlayShell]]. Wrapper now hosts panel + comments column + a vertical rail button as flex siblings. Wrapper max-width animates between `64rem` (closed) and `1400px` (open) via Framer Motion; column slides in from the right with `flex-basis 0% → 40%`, `opacity 0 → 1`, `translateX 40 → 0`, `marginLeft 0 → 0.75rem` — all animated together so neither end of the close transition snaps. Rail button pinned at `right: 0` of the wrapper so it tracks the rightmost visible surface (panel when closed, column when open). ESC collapses comments first; `e.stopPropagation()` on the rail button prevents the backdrop close from firing.

**URL-driven overlay reactivity** in [[useOverlay]]. Replaced the `popstate`-only listener (which missed `next/link` navigation) with `useSearchParams()` from `next/navigation`. Now the overlay opens on any URL change with `?item=…` regardless of how the URL got there. New `?comment=<id>` deep-link param read by [[OverlayShell]] auto-opens the comments column AND focuses the matching comment.

**Focused-comment behavior.** When `?comment=` is present, [[CommentList]] threads the focused id down to the matching `CommentNodeView`, which after a 600ms delay (column slide-in completes first) calls `scrollIntoView({ behavior: 'smooth', block: 'center' })` and applies the `comment-focus-flash` class. The flash is a CSS keyframe outline pulse (cyan, 2.4s, no `fill-mode`) — non-permanent: outline reverts to none after animation, leaving the user-own-comment background intact.

**Saved-comments dashboard surface** [[SavedCommentsSection]] under `Guardados/Comentarios` (new sidebar entry, NOT a stub). Two-level draggable file explorer:
- **Folder grid** — one folder per publication with saved comments, showing the article thumbnail, title, type label, and comment-count badge. Single-click drills in. Namespace `saved-comments:folders`.
- **File grid** — one tile per comment within a folder, draggable. Click expands inline to reveal full body + `ABRIR EN OVERLAY ›` (deep-links via `?item=…&comment=…`) + `★ QUITAR`. Namespace `saved-comments:files:<articleId>` so each article's drag layout is independent.

**Generic primitive** [[DraggableCanvas]] — extracted the canvas + position store + drag mechanics so saved-comments can have free-form positioning matching Drafts/Publicados. Click-vs-drag disambiguated by 4px movement threshold so inner buttons (QUITAR, ABRIR) survive. Bails out of pointer capture on `target.closest('button, a, input, ...')`. Older [[DraggableFileGrid]] (used by Drafts/Publicados) left untouched — refactor to consolidate is a separate task.

### Verified in preview

- Login: log in as `loma_grave` via QUICK·SWITCH → AuthBadge shows `@loma_grave`, sessionStorage stores `{ userId: "u-og-loma" }`. `admin/admin` form path resolves to `u-datavismo`.
- Comments mount: open `ar-001` overlay → click rail button → column slides in at 40% width, 11 seed comments rendered, sort produces cm-001(4 replies) → cm-006(2) → cm-009(tombstone, 1) → cm-011(0).
- Reactions: click `[+]` on cm-001 → loma_grave's existing seed reaction removed → count drops `[+] 2 → 1`, button aria-pressed=false, `reactionOverrides` persisted.
- Composer: type "Comentario de prueba" in root composer → ENVIAR → new comment appears at end of list (0 activity, lowest sort priority), id `cm-session-…` persisted in `added`.
- Reply: click `↳ RESPONDER` under cm-006 → textarea expands inline, single textarea instance.
- Save: click `★ GUARDAR` on cm-001 → button flips to `★ GUARDADO` orange, `savedIds: ["cm-001"]` persisted.
- Dashboard: `Guardados/Comentarios` shows 3 folders for 4 saved comments (cm-001, cm-006, cm-014, cm-017). Click ar-001 folder → file view with 2 tiles. Click cm-001 → expands inline with body + ABRIR + QUITAR.
- Drag: pointerdown→move→up on first folder tile dragged it from `(12,12)` → `(82,93)`, position persisted under `gradiente:dashboard:positions:saved-comments:folders`.
- Deep-link: navigate to `/?item=festivales-latam-presion-europea-2026&comment=cm-005` → overlay mounts, comments column already open, cm-005 has `data-focused="true"` and `comment-focus-flash` class, no other comment is focused.
- TÚ indicator: as `loma_grave`, cm-006 (her authored comment) renders with `data-own="true"` and the TÚ chip; sibling comments don't.

### Memory updates

None this session — no new behavioral preferences or feedback surfaced; existing memos still accurate.

### Open follow-ups

- Wiki: per-component pages for [[CommentList]], [[CommentsColumn]], [[CommentComposer]], [[SavedCommentsSection]], [[DraggableCanvas]] landed alongside this entry. Module pages for [[mockUsers]], [[mockComments]], [[permissions]] are pointers in [[index]] only — write full pages if those modules grow new behavior worth documenting.
- Saved comments are not user-keyed in sessionStorage — switching between mock users in the same tab shows the previous user's saves. Acceptable for prototype; real backend keys by user.
- Closing the overlay leaves an orphan `?comment=` param in the URL (only `?item=` is cleared). Harmless visually since the overlay is unmounted, but worth scrubbing when we touch [[useOverlay]] again.
- Scroll-to-focused-comment doesn't expand a depth-cap-collapsed subtree if the focused id lives deeper than depth 4. None of the current seed targets exercise this; landing it requires walking the tree and auto-expanding on the path to the focused id.

---

## 2026-04-25 · INGEST · Dashboard explorer revamp + header auth

Replaced the flat dashboard with a retro file-explorer shell, restructured around a `Guardados/` future-purpose folder, and overhauled the header auth controls so LOGIN/DASHBOARD/SALIR actually read at a glance.

**New module** [[Dashboard Explorer]]. The shell wraps every dashboard surface in a 3-column window (sidebar + window + details panel) with a top breadcrumb. Single page at [`app/dashboard/page.tsx`](../../app/dashboard/page.tsx) dispatches sections via `?section=`. Old `/dashboard/drafts` becomes a client redirect to `/dashboard?section=drafts`.

**Sections wired:**
- `home` — landing tiles (Nuevo / Drafts / Publicados / Perfil)
- `nuevo` — 8 type templates rendered as folded-corner file icons; click → details panel + bottom info bar; double-click → form
- `drafts` / `publicados` — free-form draggable color-coded file workspace, positions persist per-namespace in sessionStorage
- `profile` — identity card + editable name/city/bio/firma (no pronouns — explicit user request)
- `guardados-{feed|agenda|noticias|reviews|mixes|editoriales|articulos}` — disabled stubs reserving slots for the future save-from-feed surface (see [[Guardados Roadmap]] in memory)

**Trim pass.** First iteration mirrored a Windows-style file manager more literally — Cut/Copy/Paste toolbar buttons, fake `48.7 GB / 120 GB` storage gauge, Media folder, Archivo grouping with Eliminados, orphan content-type sidebar entries, redundant bottom INFORMACIÓN bar duplicating the right-side DETALLES panel. All cut. Storage panel repurposed as **ESTADO DE LA UNIDAD** with real counts (drafts / publicados / guardados / last-edit) + soft 50-item cuota.

**Layout fixes:**
- VibeSlider hidden on `/dashboard` — feed-curation control, not editor concern. Implemented via `usePathname()` early-return wrapper around the impl ([VibeSlider.tsx](../../components/VibeSlider.tsx)).
- ExplorerShell now `min-h-[calc(100vh-200px)]` with the row `flex-1` and the window stretching — short sections (Profile) no longer leave a gap above the footer, since `body { min-height: 100vh }` was pushing the footer down past short content.

**Header auth redesign** — see [[AuthBadge]]. The previous chip used 8px text in dim `#FF6600` buried between near-invisible 6px captions (`UNIT·ACCESS`, `ID·NULL`). Replaced with: 13px Syne Black labels in bright `#FF8C00` / `#4ADE80` with EVA glow, blinking/pulsing dot, username inline at `#888`, and `SALIR` (icon + label, hover→sys-red) instead of a lone `⏻` glyph. Captions dropped — they only added noise around the actual button.

### Verified in preview

- `/dashboard` → home tiles render; sidebar shows the 5 flat items + Guardados folder with 7 stubs; ESTADO DE LA UNIDAD reactive
- `?section=nuevo` → 8 file icons, click MIX → details + CTA `USAR ESTA PLANTILLA`
- `?section=drafts` → seeded 4 drafts → drag from `(12,12)` → `(106,103)` → reload → position persists
- `?section=publicados` → separate position namespace
- `?section=profile` → no pronouns field; storage panel sits 720px+ above footer (no overflow)
- `?section=guardados-mixes` → placeholder explains future save flow + perks roadmap
- `/dashboard/drafts` → 200 redirect → lands on `?section=drafts`
- Header logged out → `LOGIN` at 13px `#FF8C00`, 139×53px tappable
- Header logged in → `DASHBOARD` at 13px `#4ADE80` + `@admin` username + `SALIR` button (79px, hover red)

### Memory updates

- [feedback: no decorative chrome](../../../C--Users-Iker-Documents-Gradiente/memory/feedback_no_decorative_chrome.md) — every affordance must work today or have a named future purpose
- [project: Guardados → club perks roadmap](../../../C--Users-Iker-Documents-Gradiente/memory/project_guardados_perks_vision.md) — three-stage arc (save-from-feed → attendance markers → verifiable partner perks)

---

## 2026-04-25 · INGEST · Chunk 3-C — Brand pages

Closes Chunk 3 (Discovery + identity). Adds three identity surfaces — `/about`, `/manifesto`, `/equipo` — with terminal-aesthetic chrome. Copy is intentionally placeholder; the editorial team fills in finished prose later.

**Shared shell** [components/brand/BrandPageShell.tsx](../../components/brand/BrandPageShell.tsx). Three tiny exports:
- `<BrandPageShell>` — header (orange `//SUBSISTEMA · X` chip + pulsing dot, font-syne display title, optional dek) + a single max-w-3xl reading column
- `<BrandSection index={N} title="...">` — `§01 TITLE` heading idiom borrowed from [[ArticuloOverlay]] so the visual language stays consistent across long-form
- `<Redactar note?="..." />` — bright red `[REDACTAR · note]` chip with a pulsing dot. Visible enough that finished copy can't be shipped without removing it

**Routes:**
- [app/about/page.tsx](../../app/about/page.tsx) — what Gradiente FM is, vibe filter explainer, FASCINOMA + Club Japan connections. 3 `[REDACTAR]` markers
- [app/manifesto/page.tsx](../../app/manifesto/page.tsx) — editorial declaration scaffolded around the principles in `wiki/90-Decisions/` (No Algorithm, Guides Not Gatekeepers, Vibe Spectrum). 7 `[REDACTAR]` markers — section bodies are placeholders
- [app/equipo/page.tsx](../../app/equipo/page.tsx) — list of collaborators (`datavismo-cmyk`, `hzamorate`, `ikerio` per [CLAUDE.md](../../CLAUDE.md)) with GitHub links + per-person `[REDACTAR]` bios

**Footer wiring** in [app/layout.tsx](../../app/layout.tsx) — added a `<nav>` between the SUBSISTEMA chip and the GRADIENTE strip with `/ABOUT · /MANIFIESTO · /EQUIPO` links. Footer becomes a flex-wrap on mobile so the link row stacks cleanly under the chip without crushing the lat/lon block.

### Verified in preview

- `/about` → renders `//SUBSISTEMA · ABOUT`, title "QUÉ ES GRADIENTE FM", 3 `[REDACTAR]` chips visible
- Footer → `/manifesto` → `//SUBSISTEMA · MANIFIESTO`, title "GUÍAS, NO PORTEROS", 7 `[REDACTAR]` chips, "NO HAY ALGORITMO" section present
- Footer → `/equipo` → all three collaborator handles + clickable `https://github.com/<handle>` links per row

### Chunk 3 status

| Chunk | Status |
|---|---|
| 3-A — Search overlay | ✓ done |
| 3-B — Clickable genre chips (incl. AnimatePresence-blocks-unmount fix) | ✓ done |
| 3-C — Brand pages | ✓ done |

[[Next Session]] closed out for Chunk 3. New roadmap items are open for whoever picks up next: mobile pass, dashboard chrome redesign, the deferred backend work, or the smaller [[Open Questions]] items (Tailwind `base` rename, reduced-motion respect, missing exit-fade).

---

## 2026-04-25 · INGEST · Chunk 3-B — Clickable genre chips

Genre chips on cards + overlays now filter the home grid in-page. Same idiom as the existing category filter ([[CategoryRail]] → [[FeedHeader]] reactive strip), composes with it (both can be active simultaneously and intersect).

**New module** [components/genre/GenreChipButton.tsx](../../components/genre/GenreChipButton.tsx) — reusable chip wrapper that:
- Calls `setGenreFilter(genreId)` on click
- Closes any open overlay via [[useOverlay]] (so clicking inside an overlay drops you back to the home grid showing the filtered set)
- `router.push('/')` if not already on home (since the filter only applies on the home feed)
- `e.stopPropagation() + preventDefault()` so the chip click doesn't bubble to the card and reopen the overlay

**[[VibeContext]]** extended with `genreFilter: string | null` + `setGenreFilter`. Stores the genre id (matches `ContentItem.genres` entries), parallel to the existing `categoryFilter`.

**[[ContentGrid]] filter pipeline** got a new step right after the category filter — `mode === 'home' && genreFilter ? filtered.filter(i => i.genres.includes(genreFilter)) : filtered`. Type-specific routes ignore both filters as before. Updated useMemo deps.

**[[FeedHeader]]** rewrote the reactive strip to surface BOTH filters when active. Header reads `//SUBSISTEMA · FILTRADO · CATEGORIA · GÉNERO·NAME`. Independent `[×] LIMPIAR SECCIÓN` and `[×] LIMPIAR GÉNERO` buttons clear each axis individually.

**Chip render sites wired** to `GenreChipButton`:
- [[ContentCard]] sm/md/lg variants
- [[HeroCard]]
- All six overlays: [[ReaderOverlay]] (two render sites — bordered chip + ETIQUETAS rail list), [[ArticuloOverlay]] (rail list), [[ListicleOverlay]] (rail list), [[MixOverlay]] (orange-bordered chip), [[EventoOverlay]] (vibe-bg chip), [[GenericOverlay]] (vibe-bg chip)

For each render site, swapped `getGenreNames(item.genres)` (names only) for `item.genres.map(id => ({ id, name: getGenreById(id)?.name ?? id }))` (id+name pairs) so the click handler can pass the canonical id while the chip displays the human label.

The orphan linear cards [[MixCard]] / [[EventCard]] / [[ArticleCard]] (used by the not-wired-to-pages [[ContentFeed]]) were intentionally NOT updated — they don't appear in the live UI.

### Pre-existing bug uncovered + fixed: AnimatePresence blocked unmount

While verifying the genre filter wasn't visibly reducing the grid (despite `ranked.length` correctly dropping from 78 to 15 to 3), discovered that the [[ContentGrid]] `<AnimatePresence>` wrapper had been keeping ALL filtered-out cards mounted in the DOM at full opacity — even with `mode="popLayout"`, even with the `MosaicItem` wrapped in `forwardRef`, even with `layoutId` removed. Cards' exit transitions weren't firing; they just stayed.

This explains why **the in-page category filter has been silently broken**: clicking a CategoryRail row would update `categoryFilter` state, [[FeedHeader]] would reflect the new filter, `ranked` would correctly compute only N items — but the grid still rendered all 78 because AnimatePresence held onto them. Easy to miss because the FeedHeader UX gives a strong "filter is active" signal. Likely been broken since the AnimatePresence wrapper was added.

Fix: removed `<AnimatePresence>` from [[ContentGrid]] entirely. Each `<motion.div>` (MosaicItem) keeps its own `layout` + `initial`/`animate` props, so cards still get a smooth mount + reflow when the grid changes. The trade-off is no exit-fade animation when items leave (they unmount immediately) — acceptable for filter UX. If a richer exit animation matters later, the path forward is to find a Framer Motion 12 incantation that actually lets `popLayout` complete the exit without the children getting stuck mounted.

Also added `forwardRef` to `MosaicItem` for future flexibility (any parent that wants to attach a ref).

### Verified end-to-end in preview

1. Click `[Cumbia Electrónica]` chip on a home card → grid filters to 3 cards, all cumbia, FeedHeader reads `//SUBSISTEMA · FILTRADO · GÉNERO·CUMBIA ELECTRÓNICA`
2. Click `[×] LIMPIAR GÉNERO` → grid restores to 78
3. Open `?item=espectro-mix-008` (mix overlay) → click a genre chip inside → URL drops `?item=`, overlay closes, home grid filters to 11 (Minimal / Deep Tech), FeedHeader reflects new filter
4. Category filter via [[CategoryRail]] now also visibly reduces the grid (incidentally fixed by the AnimatePresence change)

[[Next Session]] roadmap: 3-A and 3-B done; only 3-C (brand pages) remains in this chunk.

---

## 2026-04-25 · INGEST · Fix — overlay PUBLICAR AHORA now goes through confirm modal

User caught an inconsistency: clicking `▶ PUBLICAR AHORA` from the draft overlay published the item directly, bypassing the [[Publish Confirmation Flow]] gate that the pending-card corner button uses. Fix is one line in [components/overlay/OverlayShell.tsx](../../components/overlay/OverlayShell.tsx) — `SessionItemStrip.handlePublish` now calls `usePublishConfirm.openConfirm(item.id)` instead of `upsertItem(item, 'published')` directly. Both surfaces now route through the same `[[PublishConfirmOverlay]]` modal.

Verified end-to-end in preview: draft → overlay PUBLICAR AHORA → modal opens with item preview → cancel keeps draft in `draft` state, confirm flips it to `published` and re-renders the strip from orange `DRAFT·SESIÓN` to green `PUBLICADO·SESIÓN`.

[[Publish Confirmation Flow]] updated with a new "Draft → Confirm (from overlay)" subsection under `## How` documenting this third entry point to the gate.

---

## 2026-04-25 · INGEST · Chunk 3-A — Search overlay

First piece of the Discovery + identity chunk. Adds the `/`-invoked search overlay called for in [[Next Session]].

**New module** [components/search/useSearch.tsx](../../components/search/useSearch.tsx) — `<SearchProvider>` + `useSearch()`. Owns the open/close state and the global `/` keyboard listener. The listener skips editable targets (`<input>`, `<textarea>`, `<select>`, contenteditable) and skips when modifier keys are held, so typing `/` into form fields works untouched and OS shortcuts pass through. `preventDefault` only fires when actually opening, so unrelated keystrokes aren't eaten.

**New component** [components/search/SearchOverlay.tsx](../../components/search/SearchOverlay.tsx). Borrowed the panel chrome from [[LoginOverlay]] / [[PublishConfirmOverlay]] (`eva-box eva-scanlines`, EVA-orange `//BÚSQUEDA` header chip, `[ESC] CERRAR`, backdrop blur, body scroll lock). Anchored top-of-viewport (`pt-20 items-start`) instead of centered — reads more like a command palette than a modal.

Per Next Session's brief — **invoked mode, not a default top-bar input**. No engagement-driven autocomplete, no ranking. The search results render as a focused subsystem mirroring [[FeedHeader]]: `//SUBSISTEMA · BÚSQUEDA · 'query' // N RESULTADOS` (pulsing dot, EVA orange). Empty-query state shows the keyboard hint `ESCRIBE PARA BUSCAR · ↑↓ NAVEGAR · ↵ ABRIR · ESC SALIR`.

**Corpus**: `MOCK_ITEMS` ∪ `useDraftItems()` deduped by slug (drafts win — editor's working copy beats seeded version). `partner` items excluded (sponsor rail, never surfaced through reading flow — [[Partners Isolation]]).

**Match**: substring against per-item haystack of `title + subtitle + excerpt + author + venue + artists`. First 30 hits, then a `· REFINA EL TÉRMINO ·` footer prompt.

**Result row**: type chip in `categoryColor(item.type)`, mono title, per-type secondary line (venue + artists for evento, artists for mix, author/subtitle for editorial-family), `[↵]` chevron on the selected row.

**Keyboard**: `↑/↓` move selection (clamped, reset to 0 on query change), `Enter` closes search and opens the selected item via [[useOverlay]] — same flow a card click takes, URL syncs to `?item=`. `Esc` closes. Hover updates selection so keyboard resumes from cursor position. Listeners bound at window level so focus drift doesn't break navigation.

**Layout wiring**: `<SearchProvider>` placed inside `<OverlayProvider>` (since `<SearchOverlay>` uses both contexts) and above `<CRTOverlay>` so state survives CRT mode flips. Mounted alongside the other overlays.

**Verified end-to-end** in preview:
1. `/` opens, input auto-focused
2. `donato dozzy` → 4 results across event/mix/noticia (matches Next Session's example exactly)
3. ↑↓ moves selection (`[↵]` indicator follows)
4. ESC closes, body scroll unlocks
5. Enter on a result closes search and opens the content overlay (`?item=fascinoma-2026-cdmx-outdoor`)
6. `/` is correctly suppressed when typing in dashboard form fields

[[index]] updated. New note [[SearchOverlay]] in `40 — Components`. No [[Open Questions]] entry closed (the search question wasn't filed there — it was a Next Session item).

---

## 2026-04-25 · INGEST · Editor closure — chunks 1 + 2

Two long arcs that close the dashboard publishing loop end-to-end. Recorded as a single entry since the work was continuous.

### Arc 1 — Quick wins (the dashboard → feed loop)

**Drafts surface in the feed.** New module [[drafts]] (`lib/drafts.ts`) owns a sessionStorage-backed store of `DraftItem` (a `ContentItem` with frontend-only `_draftState` + `_createdAt` + `_updatedAt`). Subscriber pattern fires `notify()` on every mutation so consumers re-render without reload. Public API:
- `getAllItems() / getItemById(id)`
- `upsertItem(item, state)` — insert or update by id
- `removeItem(id)`
- `useDraftItems()` hook for components
- `newItemId(type)` — stable id generator

**HomeFeedWithDrafts** ([[FeedHeader]]'s sibling) — client wrapper around [[ContentGrid]] that merges session items into the feed. Two phases of evolution:
- v1: prepend ALL session items (drafts + published) so dashboard publish surfaces immediately
- v2: filter to only `published` items + the one matching `?pending=<id>`. Pure drafts no longer pollute the public feed; they live in [[Dashboard Drafts]]. Aligns with the editor's POV: drafts are private work-in-progress.

**[DRAFT·SESIÓN] chip** added to [[ContentCard]] when `_draftState === 'draft'`. Mostly dormant on the home feed (drafts hidden) but still useful in the drafts list view.

**Session item strip** in [[OverlayShell]] — when an item has `_draftState`, a horizontal action bar appears between the chrome and the content:
- Draft items: orange strip with `EDITAR / ELIMINAR / ▶ PUBLICAR AHORA`
- Published items: green strip with `EDITAR / ELIMINAR`
- Real MOCK_ITEMS content: nothing

**404 page** ([app/not-found.tsx](../../app/not-found.tsx)) — terminal-aesthetic glitch. `// SEÑAL PERDIDA` headline with red text-shadow, glitching path readout that scrambles every 220ms via a chained-pattern `scramble()` helper, terminal "DIAGNÓSTICO" block listing failed system checks, RETORNAR AL FEED + category quick-links, hazard-stripe chrome.

**ShareButton** ([components/overlay/ShareButton.tsx](../../components/overlay/ShareButton.tsx)) — slotted into [[OverlayShell]]'s header next to ONLINE. `[⎘ COPIAR ENLACE]` → flips to green `ENLACE·COPIADO` for 1.8s. Uses `navigator.clipboard.writeText` with `execCommand` fallback for non-secure contexts.

**MixOverlay related-mixes section** — `04 SIGUIENTES MIXES` after the existing 3 panels. Curated by genre overlap, falls back to recent. Mirrors the [[ArticuloOverlay]] / [[ListicleOverlay]] pattern.

**Save indicator** — [[Dashboard Forms]] `SubmitFooter` now shows `◉ AUTOSAVE · HACE Xs` next to the action chips. Updates every 5 seconds via setInterval; reads `lastSavedAt` from `useDraftWorkbench`.

**Type-specific empty states** in [[ContentGrid]] — instead of a generic `// SIN CONTENIDO`, each filtered type gets its own copy: `// CABINA · BOOTH VACÍO` for mix, `// AGENDA · CALMA TEMPORAL` for evento, etc. Reads the active categoryFilter from [[VibeContext]].

**Bugs caught mid-build:**
- `commitItem` import was wrong (named export lived in `Fields.tsx`, not `lib/drafts.ts`); fixed to `upsertItem as _commitItem`.
- [[OverlayRouter]] only resolved slugs from MOCK_ITEMS — extended to look in `useDraftItems()` first so draft cards open via overlay.

### Arc 2 — Two-state model + pending confirmation + edit flow

User feedback drove a refactor of how publishing actually works. The key insight: a single one-click `PUBLICAR` button is too dangerous; a draft-saved-but-not-yet-public state is meaningful; pending content should be visible in the feed during review but visually distinct.

**Two-state model:**
- `SubmitFooter` now has TWO actions instead of one: `▣ GUARDAR DRAFT` (grey) and `▶ PUBLICAR` (orange).
- `useDraftWorkbench`'s old `publish()` was renamed `requestPublish()` — saves as draft + returns the item id. The actual transition to `published` happens elsewhere (see below).
- `saveDraft()` unchanged.
- The form's `onPublish` handler is now: `requestPublish() → setCategoryFilter(null) → router.push('/?pending=<id>')`.

**See [[Publish Confirmation Flow]]** for the full design rationale and state-machine sketch.

**Visual primitives for the pending state:**
- New CSS keyframes in [globals.css](../../app/globals.css): `pending-border-pulse` (red↔orange, 1.6s), `pending-scanline-sweep` (vertical line traversal, 2.4s), `pending-cover-flicker` (CRT distortion on cover image, 3.2s with 4-step keyframe punches), `pending-chip-flicker` (subtle opacity pulse on the chip).
- [[ContentCard]] renders `[PENDIENTE·CONFIRMAR]` chip (red) + glitch border + scanline overlay + cover flicker when `_pendingConfirm` is set. Replaces the `[DRAFT·SESIÓN]` chip in this state — only one signal at a time, less visual noise.
- Auto-scroll-into-view on mount when pending so the editor doesn't have to hunt for their card.
- Corner button `[✓ CONFIRMAR]` floating top-right, opens the confirmation modal.

**Confirmation modal** — new [[PublishConfirmOverlay]], globally mounted at layout level (alongside [[LoginOverlay]]). Driven by `usePublishConfirm` context — same shape as `useAuth`. Modal shows item type/slug/title preview + warning copy + `CANCELAR` / `▶ PUBLICAR DEFINITIVAMENTE`. On confirm: `upsertItem(item, 'published')` + clears `?pending` URL param via `router.replace`.

**Filter clear on publish** — when a category filter is active and the editor publishes a different type, the new card would be filtered out and invisible. Each form's `onPublish` calls `setCategoryFilter(null)` before routing. Surgical: only fires at publish-time, not on dashboard entry, so browsing-time filters are preserved.

**Edit flow** — any session item (draft OR published) gets `[✎ EDITAR]` in its overlay strip. Routes to `/dashboard?type=<type>&edit=<id>`.
- `useDraftWorkbench` accepts `editItemId` prop. On hydrate, prefers `getItemById(editItemId)` over the per-form local-draft key.
- Strips `_draftState` and `_pendingConfirm` flags before populating form state.
- Sets `committedId` to the existing item's id so subsequent saves UPDATE the same row instead of creating a new one.
- Wired in all 7 forms via `useSearchParams().get('edit')`.

**Visual session-strip differentiation:**
- Drafts: orange chrome, all 3 actions
- Published: green chrome, just edit + delete (already live; no need to re-publish)

### Arc 3 — Chunk 2: Editor closure

**Drafts list page** — `/dashboard/drafts` ([[Dashboard Drafts]]):
- Auth-guarded same as `/dashboard`
- Header row counts (`3 ENTRADAS · 2 DRAFTS · 1 PUBLICADAS`)
- Type filter chips (only types present, with per-type counts)
- State filter chips (TODOS / DRAFTS / PUBLICADAS) — composes with type
- Table rows: type chip · state chip (orange-pulsing draft, green published) · title + slug · `hace Xh` updated · `[✎ EDITAR]` `[▶ PUBLICAR]` (drafts only) `[🗑]`
- Empty states: "BANDEJA VACÍA" for fresh sessions, "SIN COINCIDENCIAS" for over-narrow filters
- Sorted newest-updated first
- DRAFTS link in [[Dashboard]] header status strip with live count from `useDraftItems()`

**Form validation feedback:**
- New `required` prop on `TextField` / `TextArea` → renders red `*` next to label, red-tinted border when empty
- New `errors: string[]` prop on `SubmitFooter` → renders `⚠ FALTA: TÍTULO · SLUG` red chip when invalid
- Each form computes its own errors array from required-field rules
- Eventually replaces the silent disabled-button-with-no-explanation pattern

**Image upload** — `ImageUrlField` extended with three input modes:
- Type / paste URL (existing)
- `[⎘ ELEGIR ARCHIVO]` button → native file picker → reads as data URL via `FileReader`
- Drag image onto the field → reads as data URL
- Result stored as a string (URL or `data:image/...;base64,...`) — drop-in for `imageUrl` everywhere
- URL field shows truncated display when storing a data URL (`data:image/png… [archivo cargado · 142 KB]`) + readonly to prevent corruption
- `[×] LIMPIAR` button to clear
- Type validation: rejects non-image with red error chip
- When backend lands, file picker / drop swap to upload-and-return-URL; rest of the form contract unchanged

**Opinion form** ([[Dashboard Forms]]) — clone of EditorialForm with `type: 'opinion'`. Adds 7th type to the dashboard.

**Articulo form** — the long-deferred big one. Closes dashboard type coverage at 8/9 (only `partner` excluded — rail-only). Self-contained file (~620 lines):
- Same identity / lead / vibe / media / footer pattern as other forms
- Block editor supporting all 10 `ArticleBlock` kinds: `lede / p / h2 / h3 / quote / blockquote / image / divider / qa / list`
- Each kind gets a kind-specific editor body (text input for h2/h3, dual cite+text for quote variants, full ImageUrlField for image, list-items editor for list, speaker + isQuestion toggle for qa, etc.)
- Footnotes editor: id + text rows, add/remove, with usage hint (`[^id]` syntax)
- Glyph icons in block headers for visual scannability
- Up/down/delete per block

### Files added across both chunks (in chronological-ish order)

**lib/**
- [drafts.ts](../../lib/drafts.ts) — store + hook + types

**components/**
- [HomeFeedWithDrafts.tsx](../../components/HomeFeedWithDrafts.tsx)
- [overlay/ShareButton.tsx](../../components/overlay/ShareButton.tsx)
- [publish/usePublishConfirm.tsx](../../components/publish/usePublishConfirm.tsx)
- [publish/PublishConfirmOverlay.tsx](../../components/publish/PublishConfirmOverlay.tsx)
- [dashboard/DraftsList.tsx](../../components/dashboard/DraftsList.tsx)
- [dashboard/forms/OpinionForm.tsx](../../components/dashboard/forms/OpinionForm.tsx)
- [dashboard/forms/ArticuloForm.tsx](../../components/dashboard/forms/ArticuloForm.tsx)

**app/**
- [not-found.tsx](../../app/not-found.tsx)
- [dashboard/drafts/page.tsx](../../app/dashboard/drafts/page.tsx)

### Files modified
- [lib/types.ts](../../lib/types.ts) — `_draftState` + `_pendingConfirm` on `ContentItem`
- [components/cards/ContentCard.tsx](../../components/cards/ContentCard.tsx) — chip swap, glitch wiring, corner confirm button, auto-scroll
- [components/overlay/OverlayShell.tsx](../../components/overlay/OverlayShell.tsx) — `SessionItemStrip` (was `DraftActionStrip`), ShareButton slot
- [components/overlay/OverlayRouter.tsx](../../components/overlay/OverlayRouter.tsx) — resolves drafts before MOCK_ITEMS
- [components/overlay/MixOverlay.tsx](../../components/overlay/MixOverlay.tsx) — related section
- [components/ContentGrid.tsx](../../components/ContentGrid.tsx) — per-type empty states
- [components/dashboard/forms/shared/Fields.tsx](../../components/dashboard/forms/shared/Fields.tsx) — workbench split (saveDraft / requestPublish), CommitFlash, SaveIndicator, errors prop, required prop, FieldLabel helper, ImageUrlField with drag-drop + file picker
- All 7 form files (Mix / Listicle / Evento / Review / Editorial / Opinion / Noticia / Articulo) — useRouter + useSearchParams + useVibe; onPublish navigation; required props; errors arrays
- [app/dashboard/page.tsx](../../app/dashboard/page.tsx) — Articulo + Opinion routed; DRAFTS link with live count
- [components/dashboard/TypePicker.tsx](../../components/dashboard/TypePicker.tsx) — Articulo + Opinion meta
- [app/layout.tsx](../../app/layout.tsx) — PublishConfirmProvider + PublishConfirmOverlay mounted
- [app/globals.css](../../app/globals.css) — pending-* keyframes + utility classes

### Bugs caught mid-build (already fixed; noted for the record)

- `commitItem` import didn't exist in `lib/drafts.ts` (the named re-export lived in `Fields.tsx`). Fixed to `upsertItem as _commitItem`.
- [[OverlayRouter]] only knew about MOCK_ITEMS, so clicking a draft card opened nothing. Fixed: looks up drafts via `useDraftItems()` first.
- [[HeroCard]] `TYPE_LABEL` was missing the `listicle` entry (latent regression from listicle introduction). Fixed.
- Dashboard with active categoryFilter would publish a different type → invisible card. Fixed by `setCategoryFilter(null)` in each form's `onPublish`.
- Tailwind `base` color collision (still open as a deeper refactor; patched locally in [[MixOverlay]] earlier).

### Still open / explicitly deferred

- **Dashboard chrome redesign** — user noted DRAFTS link is too subtle in the header; deferred to a dedicated dashboard pass.
- **Real backend** — every "session" feature becomes a real DB write when [[Supabase Migration]] lands. The seam is `lib/drafts.ts`'s API — replace functions, callers don't change.
- **Audio context session** — mix transport + listicle inline track embeds + reactive HUD still deferred.
- **Inline track embeds in listicles** — still link-outs; same audio-context dependency.
- **Mobile pass** — accidental desktop-only bits (CategoryRail at lg+, AuthBadge at md+, dashboard split-view).
- **Tailwind `base` color rename** — spawned task, not yet picked up.
- **CRT scanline sweep on filter change** — user-suggested polish, see [[CRT Scanline Sweep]].
- **Reduced-motion respect** for the pending glitch + CRT animations (a11y).

### Where the dashboard now stands

| Type | Form | Notes |
|---|---|---|
| evento | ✓ | dates, venue, line-up, tickets |
| mix | ✓ | embeds, structured tracklist, contexto |
| listicle | ✓ | streamlined block editor (4 kinds incl. track) |
| articulo | ✓ | full block editor (10 kinds) + footnotes |
| review | ✓ | reader-family |
| editorial | ✓ | reader-family + editorial flag default |
| opinion | ✓ | reader-family columnist variant |
| noticia | ✓ | leaner, fast-decay |
| partner | — | rail-only, intentionally not editable |

8 of 9 types fully editable. Same pipeline for all: workbench autosave + edit hydration + filter clear + pending confirmation + drafts list management.

### New notes from this session

- [[Publish Confirmation Flow]] — design + state machine
- [[Dashboard Drafts]] — page note
- [[drafts]] — module note
- (Various component notes still pending — see [[Open Questions]])

### Updates

- [[Dashboard]] — drafts subpage link, two-state model
- [[Dashboard Forms]] — validation, image upload, articulo + opinion, edit hydration
- [[Open Questions]] — closed: drafts injection, articulo form, opinion form, save indicator, image upload, drafts list, validation feedback, MixOverlay related, 404 page
- [[index]] — new pages + components
- [[Next Session]] — fresh start brief

## 2026-04-25 · INGEST · Dashboard, in-page category filter, polish pass

Catch-up entry covering ~24h of work that wasn't logged in real time. Three big arcs.

### Arc 1 — Insider dashboard (visual prototype)

User-facing goal: editors / partners log in via header overlay, hit a `/dashboard` route, pick a content type, see a form whose layout mirrors how the type renders in the feed. Live preview panel on the right reflects edits in real time.

**Auth system** — visual prototype only, hardcoded `admin/admin`:
- [[useAuth]] context + `<AuthProvider>` wrapping the app, sessionStorage-backed.
- [[LoginOverlay]] — terminal-aesthetic modal triggered by a header button. Uses the same panel chrome as [[OverlayShell]] for visual coherence. Validates credentials, sets session, auto-closes.
- [[AuthBadge]] in [[Navigation]] — slots between MAGI cluster and timer. Swaps `LOGIN` (orange) ↔ `DASHBOARD` link (green) + `⏻` logout when authed. Mobile-only hidden for now (kept the existing `≡` toggle clean).
- When real auth lands (Supabase), `useAuth.login()` is the only thing that changes — rest of the app consumes via `useAuth()` and is provider-agnostic.

**Dashboard route** — `/dashboard`:
- Auth-guarded client component. Unauthed users get prompted via the login overlay.
- Type picker grid: 6 tiles (mix · listicle · evento · review · editorial · noticia). Each tile in the type's `categoryColor` with a top accent stripe.
- Picking a type routes to `/dashboard?type=mix` (URL-driven so back/forward works) and renders a split view: form (left) + [[LivePreview]] (right).
- Excluded from v1: `articulo` (needs full structured-block editor), `opinion` (trivial duplicate of editorial), `partner` (rail-only, separate flow). Placeholder shown if user lands on those.

**Forms — one per type**, per the per-type-components preference:
- [components/dashboard/forms/MixForm.tsx](../../components/dashboard/forms/MixForm.tsx) — full mix shape: identity, copy, vibe + genres, media, embeds, contexto (series/recordedIn/format/BPM/key/status), tracklist editor.
- [components/dashboard/forms/EventoForm.tsx](../../components/dashboard/forms/EventoForm.tsx) — date/end-date pickers (datetime-local), venue, line-up (StringListField), tickets, price.
- [components/dashboard/forms/ReviewForm.tsx](../../components/dashboard/forms/ReviewForm.tsx), [EditorialForm.tsx](../../components/dashboard/forms/EditorialForm.tsx), [NoticiaForm.tsx](../../components/dashboard/forms/NoticiaForm.tsx) — reader-family triplet sharing the same fields with type-appropriate defaults (e.g. editorial defaults `editorial: true`, noticia is leaner with no author/readTime).
- [components/dashboard/forms/ListicleForm.tsx](../../components/dashboard/forms/ListicleForm.tsx) — the most complex. Standard fields plus an `articleBody` block editor supporting four block kinds (`lede`, `p`, `divider`, `track`). Each track block has rank, artist, title, year, BPM, cover, embeds, commentary.
- Shared primitives in [components/dashboard/forms/shared/Fields.tsx](../../components/dashboard/forms/shared/Fields.tsx) — `Section`, `TextField`, `TextArea`, `Toggle`, `VibeField`, `GenreMultiSelect`, `StringListField`, `EmbedList`, `ImageUrlField`, `SubmitFooter`, plus `slugify` and `publishDraft` helpers.
- Each form: hydrate from sessionStorage on mount, autosave on change, slug auto-generated from title (overrideable).

**LivePreview** — right pane:
- Renders the draft `ContentItem` through its real overlay component (`MixOverlay`, `ListicleOverlay`, `EventoOverlay`, `ReaderOverlay`, etc.) inside a scaled-down panel that mimics [[OverlayShell]] without taking over the screen.
- Updates in real time as the form is edited. Verified by typing a title and watching the preview's H1 update synchronously.

**Submit / publish (visual only)**:
- Console-logs the constructed `ContentItem` with a fresh id + timestamp.
- Persists to `sessionStorage.gradiente:dashboard:published` (capped to 20).
- Brief green `◉ DRAFT PUBLICADO EN SESIÓN` confirmation chip.
- Drafts do NOT yet inject into the home feed — see [[Open Questions]].

**Block editor streamlined** (after first version was clearly cluttered):
- Track blocks now collapsible to a 1-row summary (rank · cover thumb · artist/title · embed count). Toggleable per block. Default expanded on add, collapsible after.
- Primary `AÑADIR TRACK` button (large, orange) + secondary chips for `LEDE` / `PÁRRAFO` / `DIVISOR` — weights the dominant content unit appropriately.
- **Auto-rank**: new track blocks pre-fill rank by detecting countdown vs. ascending pattern from existing tracks. First track 10 → next track auto-fills 9, etc.
- **Insert-between** rows: thin hairline gap between every pair of blocks; on hover a `+` reveals a mini picker to insert any kind at that position.
- **Auto-focus** lands on the first editable field of newly-added blocks (artist for track, textarea for lede/p).
- Inline cover thumb in the expanded track view — immediate visual feedback as URL is typed.
- Kind glyphs in headers (`Disc3` / `Type` / `Minus`) for quick scanning.

**Form polish — type-contextual paste handlers**:
- **Mix tracklist**: `PEGAR LISTA` toggle opens a textarea + parser. Recognizes `01. Artist - Title (134)`, `Artist — Title [134 BPM]`, `Artist - Title 134`, `Artist - Title`. Skips `#` comment lines. Live "N pistas detectadas" count. Enter in the last row's BPM cell adds a new row + auto-focuses ARTIST. Multi-line paste in any row also parses and splits in place.
- **EmbedList** (mix + listicle track blocks): URL input live-syncs platform dropdown as you type/paste (YouTube URL → tab snaps to YOUTUBE). Auto-focus on add. Multi-URL paste splits into rows with per-platform detection.
- **StringListField** (evento line-up, etc.): same `PEGAR LISTA` pattern, one entry per line. Per-row paste also splits multi-line. Enter creates new row.

**Tailwind `base` color collision regression** — see [[Open Questions]]. Hit again in `MixOverlay`'s excerpt; fixed locally with `md:text-[15px]`. Spawned task to rename the token.

### Arc 2 — Two new listicle fixtures

The user wanted to see how listicles actually look in the feed. Added two:

- **`5 eventos imperdibles · Mayo 2026`** — events-themed list using `lede / h2 / image / p / divider` blocks. Each event entry has a ranked h2, flyer image with date+venue caption, and editorial description. Demonstrates that the existing block kinds can carry an event listicle without a dedicated `event` block kind.
- **`10 tracks que definieron el verano · CDMX 2026`** — 10 track blocks countdown 10→1, summer-vibe BPMs (110-132), house/breaks/electro/disco genres. Real producers (DJ Tennis, Roman Flügel, Hagan, Anz, Karenn, Skee Mask, Floating Points, Siete Catorce, Loraine James, Donato Dozzy at #1).

### Arc 3 — In-page category filter

User flagged the rail as taking them to dedicated routes (`/agenda` etc.), breaking the contained-surface idiom. Reworked to filter the home grid in place.

**Mechanics**:
- Added `categoryFilter: ContentType | null` + `setCategoryFilter` to [[VibeContext]].
- [[CategoryRail]] refactored from `<a href>` links to `<button>` toggles. Click sets the filter; click again on the active category clears it. Added `//TODOS` pseudo-row at top (active when no filter). Added a `×` clear affordance in the SECCIÓN header that shows only when a filter is active.
- [[ContentGrid]] applies the category filter alongside the vibe filter on the home feed (mode === 'home' only — type-specific pages already filter at the route level so they're not affected).
- [[HeroCard]] returns `null` when a filter is active and doesn't match its type. Also caught a latent bug: `HeroCard.TYPE_LABEL` was missing the `listicle` entry — fixed.
- Active category dims inactive entries to 40% opacity for visual focus.

**Dedicated type routes preserved** — `/agenda`, `/mixes`, `/articulos`, etc. still exist for deep-linking and bookmarking. The rail simply no longer points to them. Editorial decision per the user.

**Transition polish** so filter changes don't snap:
- [[ContentGrid]] now wraps the items map in `<AnimatePresence mode="popLayout">`. `popLayout` is the right mode here — exiting cards stay in their original DOM slot until they finish animating, allowing remaining cards to reflow cleanly via Framer's shared-layout animation.
- Each card has explicit `initial / animate / exit`: exit is `opacity → 0`, `scale → 0.85`, 220ms easeIn (decommission feel). Initial is `opacity 0`, `scale 0.92` → animates to the prominence-driven standing scale.
- [[FeedHeader]] new client component replacing the previously static "TODO LO QUE VIENE" strip in [[Home]]. Reads `categoryFilter` and switches between the default editorial intro and a terminal-flavored `//SUBSISTEMA · FILTRADO · {TYPE}` status line (in the category color, with a pulsing dot) + a `[×] LIMPIAR FILTRO` button as a second clear affordance alongside the rail's `×`.

### Misc small things

- **Curation maps were missing `listicle`** — `ATTENTION_HALF_LIFE_HOURS`, `FRESHNESS_HALF_LIFE_HOURS`, `peaks` initializer, and `TYPE_SCORE_MULTIPLIER` all needed the new key, otherwise lookups returned undefined and produced NaN scores → invisible cards. Fixed.
- **CategoryRail was missing `listicle`** — same class of bug, same fix.
- **ContentCard / OverlayShell `TYPE_LABEL`** also needed `listicle: 'LISTA'`.
- Listicle track-block rank text overflowed its column (`md:text-6xl` in 80px col cropped under cover image). Adjusted to `md:text-5xl` in 96px col → 11px clearance.

### Out of scope / explicit deferrals

- **Drafts injecting into the home feed** — currently sessionStorage-only. The plumbing (`useDrafts()` hook + grid merge) is one focused change away. See [[Open Questions]].
- **Articulo dashboard form** — needs the `articleBody` editor to handle all block kinds (lede/p/h2/h3/quote/blockquote/image/divider/qa/list). Listicle covers the subset (lede/p/divider/track); articulo would extend.
- **CRT scanline sweep on filter change** — user-suggested polish. See new roadmap note [[CRT Scanline Sweep]].
- **Inline track embeds in listicles** — still link-outs. Deferred to the audio-context session for the same iframe-vs-Web-Audio reason as the mix player.

### New notes

- [[Dashboard]], [[useAuth]], [[LoginOverlay]], [[AuthBadge]], [[LivePreview]], [[Dashboard Forms]], [[FeedHeader]]
- [[CRT Scanline Sweep]]

### Updated notes

- [[CategoryRail]] — now in-page filter, not navigation
- [[VibeContext]] — categoryFilter added
- [[ContentGrid]] — AnimatePresence + exit animations + category filter
- [[Open Questions]] — draft injection, CRT scanline added; tailwind `base` collision still open
- [[Content Types]] — already updated previously for listicle
- [[index]]

## 2026-04-24 · INGEST · Mix overlay + Listicle content type shipped

Two deliverables, one shared infrastructure.

**Mix overlay** — mix no longer falls through to [[GenericOverlay]]. New [[MixOverlay]] renders a two-column terminal layout matching a mockup the user shared: editorial column (title, excerpt, metadata row with 10-bar vibe gauge, body, genres) + system column with three numbered panels — `01 AUDIO EMBED // REPRODUCTOR` (source tabs, cover, decorative seeded waveform, non-functional transport, `[ABRIR FUENTE]` link-out), `02 CONTEXTO` (SERIE / GRABADO EN / FORMATO / BPM / KEY / ESTATUS key-value grid), `03 TRACKLIST / ETIQUETAS` (numbered artist/title/BPM table + tag chips).

**Mix type fields extended** (see [[Content Types]]):
- `embeds: MixEmbed[]` — multi-platform sources (SoundCloud / YouTube / Spotify / Bandcamp / Mixcloud), drives the overlay tabs. `mixUrl` retained as legacy fallback.
- Structured `tracklist: MixTrack[]` — rows `{ artist, title, bpm? }` replacing the old `string[]`. Safe change — no existing mix had `tracklist` data populated.
- New context metadata: `mixSeries`, `recordedIn`, `mixFormat`, `bpmRange`, `musicalKey`, `mixStatus` (`'disponible' | 'exclusivo' | 'archivo' | 'proximamente'`).
- `mx-001` (Siete Catorce) and `mx-002` (Rat Pack Crew) enriched with full shape as visual test fixtures. Other mixes degrade gracefully — empty panels show explicit empty states ("Sin metadata de contexto.", "Tracklist no publicado.").

**Listicle** — ninth content type. Concept: ranked/structured list features ("Top N tracks that defined X"). Architecturally a sibling of [[ArticuloOverlay]]: same `articleBody: ArticleBlock[]`, same prose primitives, plus a new `track` block variant `{ kind: 'track', rank, artist, title, year, bpm, imageUrl, embeds, commentary }`.

**`track` block is shared infra** — the case lives inside `BodyBlocks` in [[ArticuloOverlay]] (which is now exported). This means any `articulo` can also embed track references with zero duplication. Listicle is where it's the primary content unit; articulo could use it for inline track citations.

**Routing/labeling:**
- `'listicle'` added to `ContentType`, `categoryColor` (`#FB923C` orange — shares the mix panel color family), `TYPE_LABEL` ('LISTA' — Spanish convention; internal key stays 'listicle' to match the user's terminology).
- Curation tuning: [curation.ts](../../lib/curation.ts) `ATTENTION_HALF_LIFE_HOURS`, `FRESHNESS_HALF_LIFE_HOURS`, `peaks` initializer, and `TYPE_SCORE_MULTIPLIER` (1.3, matches articulo) all extended. Without these, `Record<ContentType, number>` lookups returned undefined at runtime, producing NaN scores and invisible cards — caught during verification.

**Visual prototype scope:**
- **Audio playback is not wired anywhere** — transport controls in mix overlay are visible but disabled; track-block source buttons in listicles are link-outs (`<a target="_blank">`). Per user decision, all audio work (persistent audio across overlays, reactive-from-audio HUD, custom transport, click-to-embed facade for listicle tracks) is deferred to a dedicated audio-context session. See [[Open Questions]].
- Iframe-based embeds were explicitly avoided — iframes sandbox the audio stream and would have to be ripped out when the audio session happens anyway.

**Shared infrastructure landed:**
- [[Embed Primitive]] — `components/embed/platforms.ts` holds `PLATFORM_LABELS`, `PLATFORM_ORDER`, and `detectPlatform(url)`. Small by design; will grow (iframe src builders, `<EmbedPlayer>` component) when the audio session happens.

**Bug surfaced, partially fixed:** Tailwind config in [tailwind.config.ts](../../tailwind.config.ts) declares `colors.base: '#000000'`. This makes Tailwind generate `.text-base { color: #000000 }` alongside the default font-size rule. At md+ breakpoint, `md:text-base` overrode `text-secondary` on the excerpt `<p>`, rendering the text invisible on the black background (user-reported). Fixed locally in [[MixOverlay]] with `md:text-[15px]`; the latent bug remains anywhere else using `text-base` or `md:text-base`. A spawned task was filed to rename the `base` color token and sweep usages. Spot-check [[GenericOverlay]] at `text-base`. Flagged in [[Open Questions]].

**New fixtures:**
- One enriched mix (mx-001) matching the mockup's richness — multi-source embeds, full CONTEXTO, 5-row tracklist.
- One listicle (`li-hard-techno-cdmx-2026`) — "5 tracks que definieron el hard techno en CDMX · 2026" — with lede, intermission paragraphs, divider blocks, and 5 countdown-ranked `track` blocks each with 2-4 source embeds spanning all four major platforms.

**Layout fix during verification:** Rank digits in track blocks initially used `md:text-6xl` in an 80px column, overflowing into the cover image. Adjusted to `md:text-5xl` in a 96px column — 5px overflow absorbed by grid gap, 11px clearance to cover.

**New notes:**
- [[MixOverlay]], [[ListicleOverlay]], [[Embed Primitive]]
- [[Content Types]] expanded with listicle section and full mix field docs

**Updates:**
- [[Open Questions]] — MixOverlay resolved; audio-context session consolidation added; tailwind `base` color collision noted.

**Next up (per user):** admin dashboard with morphing upload forms. The listicle is ready — dashboard needs to offer it as one of the upload type options alongside evento / mix / noticia / review / editorial / opinion / articulo.

## 2026-04-24 · INGEST · VibeSlider redesigned — phosphor tape + continuous range

[[VibeSlider]] rebuilt end-to-end to resolve the choppy clipped-gradient look and the integer-snap slider feel.

**Visual — from clipped stripe band → phosphor tape:**
- Removed `STRIPE_MASK`, `NEON_GRADIENT`, and the `clipPath: inset()` overlay. The old design cropped a full-width rainbow with a 45° black mask; as the handle moved, the crop was visually choppy and the mask made the colors feel muddy.
- Replaced with **three horizontal rows of short vertical dashes** evoking a static waveform display: 120 dashes in the middle row (dense, near-continuous baseline), 40 in the top and bottom rows at a half-step offset from each other to create a subtle saw rhythm. All dashes 2.5px wide, 3–6px tall, with a tight colored halo glow when lit.
- Each dash's color is computed once via a new `interpolateVibeColor()` helper that linearly interpolates between adjacent `vibeToColor()` anchors — so the band is smooth but snaps to the discrete per-item slot colors at integer positions. See [[Vibe Gradient]] for the updated three-expression breakdown.
- Dash positions/widths use a `Math.imul`-based integer hash — bit-exact across Node SSR and V8 client, avoiding React hydration warnings (earlier `Math.sin`-based attempt produced last-digit FP drift between server/client).

**Mechanics — from stepped → continuous:**
- `getValueFromX` no longer rounds: `vibeRange` now stores continuous floats in `[0, 10]` rather than integers 0–10. Dragging from GLACIAL toward VOLCÁN glides smoothly instead of snapping per-slot.
- Handle label and label color still snap to the nearest integer slot via `Math.round(min)` — the named vibes (GLACIAL, POLAR, CHILL…) remain legible rather than reading `3.73`.
- The lit/unlit boundary inside the phosphor tape is **pixel-precise** — each dash stores its exact float vibe and the `d.vibe >= min && d.vibe <= max` check produces a crisp boundary that slides smoothly with the handle.
- Content filtering (`filterByVibe` in [[ContentGrid]] / [[ContentFeed]]) automatically benefits — items' integer vibes compared against float boundaries give smooth activation as handles cross half-integer thresholds.

**Deliberately preserved:**
- Sticky positioning below [[Navigation]], RESET button, click-track-to-move-nearer-handle, label overlap threshold (14%), genre chip strip below the band.
- The 11 slot names (GLACIAL → VOLCÁN) are unchanged — finer granularity than `vibeToLabel` by design, needed for slider positions.

**Out of scope / deferred:**
- Unifying the three color expressions (Tailwind pastel, discrete saturated, dash interpolation) — deferred. See [[Vibe Gradient#Should they unify]].
- Making the phosphor tape reactive to audio — still future. See [[project_audio_vision]] in memory. The current static 3-row print is deliberately shaped to read as a waveform preview, priming the eye for when embeds land and the tape becomes a real HUD.

## 2026-04-23 · INGEST · Articulo content type + longform overlay shipped

Added `articulo` as the eighth content type — the longform/deep-dive tier that sits alongside `editorial` / `review` / `opinion` / `noticia` in the editorial family but gets its own reader.

**Why a new type:** `editorial` carries a curatorial/positional connotation (editor-flagged opinions, scene-shaping takes). `articulo` is reportage + form — substack-style deep-dives with interviews, pull-quotes, footnotes, section headers. Different register, different reading shape, deserves a distinct surface.

**New:**
- `articulo` added to `ContentType`, `categoryColor` (`#FDE68A` warm off-white), `TYPE_LABEL` (`ARTÍCULO`), curation half-life maps, peak initializer, score multiplier (1.3, matches review).
- `ArticleBlock` discriminated union + `Footnote` type in [`lib/types.ts`](../lib/types.ts). Structured block kinds: `lede`, `p`, `h2`, `h3`, `quote`, `blockquote`, `image`, `divider`, `qa`, `list`.
- `/articulos` route ([[Articulos]]) and `//ARTÍCULO` row in [[CategoryRail]] + [[Navigation]].
- [[ArticuloOverlay]] — longform reader distinct from [[ReaderOverlay]]: hero image is primary (not archival), sticky TOC rail with active-section tracking, drop-cap lede, vibe-colored pull-quotes, Q&A speaker labels, inline `[^id]` footnote refs → numbered endnotes, FIN hazard-stripe marker, curated `SIGUIENTES·LECTURAS` that swap in-overlay via [[OverlayRouter]].
- Three seeded articulos in [[mockData]] demonstrating the block variety.

**Deliberately NOT in scope:**
- `articulo` excluded from `getPinnedHero` allowlist — competes in the feed but doesn't auto-promote to portada. Can be revisited later.
- No engagement metrics (per [[Size and Position as Only Signals]] + [[No Algorithm]]) — "Ready for more?" translates to curated related-reading, not subscribe/share CTAs.

**Design reference:** [firstfloor.substack.com](https://firstfloor.substack.com), translated through Gradiente's terminal idiom (monospace meta, `//` prefixes, block-bar progress indicators).

## 2026-04-23 · INGEST · Card → overlay system shipped

Built and documented the full card-click-to-overlay reading surface. PR open at [feat/card-overlay](https://github.com/datavismo-cmyk/espectro-fm-web/compare/main...feat/card-overlay?expand=1).

**New UX primitive:** click any card (including the pinned hero) → full-screen overlay with CRT boot-in animation + dim/blur backdrop. URL updates via `?item=<slug>` for deep-linking, but no route change. See [[Overlay System]].

**New components:**
- [[OverlayShell]] — frame chrome, close affordances, CRT boot animation
- [[OverlayRouter]] — mount/exit state machine, type dispatch
- [[ReaderOverlay]] — terminal reader for `editorial` / `review` / `opinion` / `noticia` (8/4 split, article primary, flyer demoted to archival rail, F-key flyer lightbox, sticky scroll-progress footer)
- [[EventoOverlay]] — flyer-as-hero for `evento` (date block, line-up, tickets CTA)
- [[GenericOverlay]] — fallback for `mix` until a dedicated overlay ships

**New module:**
- [[useOverlay]] — context + hook, URL sync via `history.replaceState` (not `router.replace` — that triggered RSC refetches that remounted the overlay mid-animation)

**Two new decisions enshrined:**
- [[Contained Single Surface]] — the page is one continuous surface; card click → overlay, never a route. External URLs become explicit user-chosen escape hatches, not the default.
- [[Reader Terminal Layout]] — long-form overlays are reading subsystems, not enlarged cards. Flyer demotes to archival evidence. Per-type overlays instead of a unified shell with `switch(type)`.

**Updates to existing notes:**
- [[ContentCard]] — now clickable; opens overlay via [[useOverlay]]
- [[HeroCard]] — now clickable (whole section, including `// EN PORTADA` header bar); became a client component, `getPinnedHero` moved to [utils.ts](../../lib/utils.ts)
- [[Open Questions]] — card-click-to-detail resolved; per-type-overlay resolved; Supabase migration explicitly deprioritized (visual MVP phase)

**Deferred (noted in [[Open Questions]]):**
- MixOverlay (mix still uses [[GenericOverlay]])
- Mobile swipe-down-to-close
- Text-size / copy-link / minimap affordances mentioned in [[Reader Terminal Layout]]
- Full `body` field on `ContentItem` (we render `bodyPreview` for now)

**Tech note:** Framer Motion was attempted first for the overlay animations; animations would not fire reliably and the root cause was never identified. Switched to pure CSS keyframes in [globals.css](../../app/globals.css) — simpler and sufficient for the current motion vocabulary.

---

## 2026-04-22 · INGEST · "Do now" fixes landed

Shipped the short-effort fixes from [[Open Questions]]:

- **`CLAUDE.md` and `README.md` rewritten** as real markdown (from the Python-wrapper corrupted state). Both now reflect Gradiente branding with links into the wiki.
- **`/opinion` page created** — `app/opinion/page.tsx`, follows the same shape as [[Editorial]]. [[CategoryRail]] link now resolves.
- **[[Agenda]] tagline fixed** — `HOY → PASADO` → `FUTURO → PASADO` to match the actual DESC-by-date sort.
- **[[Editorial]] tagline simplified** — `TEXTOS & OPINIÓN` → `TEXTOS` (opinion has its own route now).
- **[[ArticleCard]] TYPE_LABEL fixed** — added missing `opinion` and `partner` entries. (Was type-failing the build as soon as strict checking ran.)
- **Next.js 14.2.21 → 14.2.35** — minor bump, build verified. Remaining CVEs require a Next 16 major upgrade; deferred.
- **ESLint rule `react/jsx-no-comment-textnodes` disabled** project-wide — `//` tokens in JSX are a deliberate NGE branding element throughout (`//EVENTO`, `//EN PORTADA`, etc.), not accidental JS comments.

**New roadmap notes created:**
- [[CRT Shader Layer]] — full-viewport CRT post-processing (blend-overlay mode first, render-to-texture mode as V2)
- [[Three.js Islands]] — isolated 3D scenes per `<Canvas>`, with `<AsciiRenderer>` from drei as the signature trick

**Not touched (explicitly deferred):**
- [[Dual Feed Systems]] — orphan delete/toggle decision still outstanding
- Next.js 16 major upgrade — too much scope for a "do now" slot; save for deployment prep
- Espectro → Gradiente content migration — coordinate with scraper cutover
- Card-click → dedicated route implementation — awaiting direction confirmation

---

## 2026-04-22 · INGEST · Editorial philosophy + data pipeline context

Context from conversation with the user:

- **Brand confirmed:** Gradiente is the new name; Espectro is the old. Content slugs + mix series titles still say Espectro. Full migration pending — coordinate with the scraper cutover so we don't rename twice.
- **Data pipeline revealed:** a Resident Advisor webscraper already exists and produced the current [[mockData]] via Excel. Productionization is the critical path — see new [[Scraper Pipeline]] note.
- **Editor dashboard is a planned feature** — see new [[Admin Dashboard]] note.
- **Editorial philosophy corrected:** I misread [[Editorial Flag]] as a quarantine. It's a boost. Editorial content lives IN the main grid alongside scraped items, competing on HP. Fixed in [[Editorial Flag]] and enshrined in new decision note [[Guides Not Gatekeepers]].
- **HP V1 vision surfaced:** HP is designed to eventually accept aggregate user interaction signals (not personalization). Currently decay-only. Added to [[Open Questions]] and [[Guides Not Gatekeepers]].
- **Card expansion discussed:** four options considered (modal, in-place expansion, inspection panel, dedicated route). Recommendation — dedicated `/[type]/[slug]` route with NGE reader chrome. See [[Open Questions]].

**New notes created:**
- [[Guides Not Gatekeepers]] (Decisions)
- [[Scraper Pipeline]] (Roadmap)
- [[Admin Dashboard]] (Roadmap)

**Notes revised:**
- [[Editorial Flag]] — fixed the quarantine misreading
- [[index]] — added new notes
- [[Open Questions]] — updated with V1 interaction loop, card expansion recommendation, body field question

---

## 2026-04-22 · INGEST · Vault bootstrap

Initial analysis of `espectro-fm-web` codebase into the wiki.

**Sources read:**
- `app/layout.tsx`, all `app/*/page.tsx` (home + 5 category pages)
- All 12 `components/**/*.tsx`
- All 5 `lib/*.ts` + `context/VibeContext.tsx`
- `tailwind.config.ts`, `next.config.mjs`, `tsconfig.json`, `app/globals.css`
- `package.json`, `.gitignore`
- Partial read of `lib/mockData.ts` (first 200 lines + file size)

**Pages created:** scaffold + ~30 notes across all 9 categories. See [[index]] for full map.

**Key findings:**
- Brand is **GRADIENTE FM** (layout metadata), not "Espectro FM" despite repo name. See [[NGE Aesthetic]].
- `CLAUDE.md` and `README.md` at repo root are **corrupted** — saved as a Python wrapper script instead of the markdown it was meant to produce. Flag for cleanup. See [[Open Questions]].
- Next.js 14.2.21 has an active security advisory. Patched version available. See [[Open Questions]].
- Two card systems coexist: `ContentCard` (mosaic) is wired; `EventCard`/`MixCard`/`ArticleCard` + `ContentFeed` are not imported anywhere. See [[Dual Feed Systems]].
- `curation.ts` references `EspectroObsidian/Espectro/02 - Features/Curation Model.md` — a prior local vault gitignored. Doesn't exist in this checkout; may live only on the lead's machine.
- Pre-existing `.gitignore` entry `EspectroObsidian/` confirms the prior vault attempt.

**Wiki setup choices:**
- Vault relocated from `Gradiente/Gradiente/` to `espectro-fm-web/wiki/` so it ships with the repo (option 1 of the sharing discussion).
- `.gitignore` extended to exclude per-user Obsidian workspace files (`workspace.json`, `workspace-mobile.json`, `workspaces.json`, `cache`, `.trash/`) while committing shared config.

**Next passes:**
- Full ingest of `lib/mockData.ts` to populate [[Content Types]] with real examples.
- Ask the team about `EspectroObsidian/Espectro/02 - Features/Curation Model.md` — reconcile with [[HP Curation System]].
- Decide fate of [[ContentFeed]] and linear card components (delete or adopt).
