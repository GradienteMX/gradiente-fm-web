# Next Session — start here

> Brief for picking up where the previous session ended.
> Last updated: **2026-04-30** (marketplace v2 shipped end-to-end — Chunks A + B + C all landed. v2 plan is closed. See [[Marketplace]] for the design doc and [[log]] for the three ingest entries.)

## How to start this session

1. Read [[index]] (orientation) and [[log]] (latest entries — the three v2 chunks at top).
2. Boot the preview (`.claude/launch.json` → `dev`, port 3003). Quick auth shortcuts:
   - `admin / admin` → `@datavismo-cmyk` (admin) — sees `Permisos` + `Marketplace · Aprobaciones`.
   - quick-switch `@loma_grave` — partnerAdmin of N.A.A.F.I. team.
   - quick-switch `@yagual` — regular team member of N.A.A.F.I.
3. Smoke the v2 surfaces:
   - `/` — marketplace rail under partners + `EXPLORAR MARKETPLACE` CTA.
   - `/marketplace?partner=naafi&listing=mkl-naafi-01` — deep-link a sub-overlay; verify gallery thumbs swap, embed chips render, ESC peels one layer at a time.
   - `/dashboard?section=mi-partner` (as loma or yagual) — 3-zone composer (left) + 3-mode preview (right) + paginated table (bottom). Click any listing in the table to hydrate the composer; everything live-syncs to the preview.

## What's left (carry-over follow-ups, all unblocked, ordered roughly by visible-impact)

### A. Embeds editor in the composer
Composer doesn't yet expose an editor for `MarketplaceListing.embeds`. The existing `EmbedList` component from `Fields.tsx` (used by [[MixForm]] / [[ListicleForm]]) drops in directly: `<EmbedList embeds={listing.embeds ?? []} onChange={(embeds) => onPatch({ embeds })} />`. Slot it into [[MiPartnerSection]]'s `ListingComposer` between description and tags. Small but unlocks self-service embed authoring for partners.

### B. Quick-filter chips inside MarketplaceOverlay
Reference screenshot has `/ VINYL · / CASSETTE · /MERCH · …` chips above the listings grid that filter by category. Today the grid is unfiltered. Implementation: chip row reading `listing.category` distinct values, controlled state in `Body`, filter on `sortedListings`.

### C. Inline embed players inside the listing detail
Today embeds are link-out chips (`SOUNDCLOUD ↗`). The audio subsystem already has SoundCloud working live (see `2026-04-26 · Audio reactive subsystem` entry in [[log]]). Plumbing that into [[MarketplaceListingDetail]] above the //FUENTES line would let buyers preview without leaving the overlay.

### D. Image lightbox
Clicking the big main image in [[MarketplaceListingDetail]] currently does nothing. A click-to-zoom expansion (full viewport modal, similar to the foro thread image float) would round out the gallery UX.

### E. Per-listing `sellerId`
Carry-over from v1 — the detail's //VENDEDOR section shows the partner's name uniformly. If different team members are selling different items, add `sellerId?: string` to `MarketplaceListing` + a team-member dropdown in the composer.

### F. Real listing-draft pipeline
Composer's `GUARDAR BORRADOR` / `PUBLICAR ITEM` buttons are cosmetic today (both close + flash). Adding `_draft?: boolean` on `MarketplaceListing` + filter in the public catalog + a `BORRADOR` pill in the table gives partners true save-then-publish semantics. Could also wrap PUBLICAR with the [[Publish Confirmation Flow]].

### Smaller polish (any session)

- **Mobile pass** — desktop layouts are locked; mobile is largely untested. The home grid mosaic, vibe slider, calendar sidebar, all six overlays, and the new marketplace surfaces all need a small-viewport pass.
- **Reduced-motion respect** — pending-publish glitch, CRT scanline, chip pulses run regardless of `prefers-reduced-motion`. WCAG-relevant a11y debt.
- **Tailwind `base` color rename** — patched locally in [[MixOverlay]]; root fix still pending. See [[Open Questions]].
- **Brand page copy** — replace `[REDACTAR]` markers in [[About]] / [[Manifesto]] / [[Equipo]] when the team writes finished prose.

## What's still under the hood

Everything described as "saved" or "published" lives in `sessionStorage` and dies when the tab closes. **No backend yet.** See [[Supabase Migration]] for the plan when it's time.

## Where we are

Front-end visual prototype. **No backend.** Everything described as "saved" or "published" lives in `sessionStorage` and dies when the tab closes.

**Reader site** is feature-complete for the visual MVP:
- Home grid with HP-driven mosaic, vibe slider, calendar, in-page category filter, partners rail
- 6 dedicated overlays (mix, listicle, articulo, evento, reader-family, generic fallback)
- 7 type-specific routes (`/agenda`, `/mixes`, etc.)
- 404 page with terminal glitch
- Click-to-copy share button in every overlay
- Per-type empty states

**Editor surfaces** are also feature-complete except for backend persistence:
- Auth overlay (`admin / admin`) → dashboard route
- 8 of 9 type forms (only `partner` excluded — rail-only)
- Live preview through real overlay components
- Two-state publish model (GUARDAR DRAFT + PUBLICAR)
- Pending-publish confirmation flow with glitching card preview
- Edit any saved item (draft OR published) → form pre-populated
- Drafts list page (`/dashboard/drafts`) for management
- Form validation feedback (required fields + missing-field summary)
- Image upload (drag-drop + file picker, data URL storage)

**User-side surfaces** (built on top of role-aware auth):
- Comments column inside every overlay (split-screen, threaded, role-colored badges, ASCII reactions, tombstones, focus-pulse from saved-comment deep-links)
- Saved-comments dashboard surface (two-level draggable folders→files)
- Save-from-feed flow (★ chip on every card + overlay header, dashboard `Guardados/*` slots show real DraggableCanvas grids per content type)
- Foro at `/foro` — imageboard-style discussion catalog (8 seed threads, 30-thread cap, bump-order, 1–5 genre tagging, vibe-slider filtering, image-required OPs, flat replies with `>>id` quote-links, backlinks, inline `TÚ` markers when someone is replying to you)

See [[log]] under `2026-04-26 · INGEST · Foro` for the latest ship list.

## Roadmap state

| Chunk | Status |
|---|---|
| 1 — Quick wins (drafts loop, 404, share, related, save indicator, empty states) | ✓ done |
| 2 — Editor closure (drafts list, validation, image upload, opinion + articulo) | ✓ done |
| 3-A — Search overlay (`/` shortcut) | ✓ done |
| 3-B — Clickable genre chips (incl. AnimatePresence-blocks-unmount fix) | ✓ done |
| 3-C — Brand pages (`/about`, `/manifesto`, `/equipo`) | ✓ done |
| Audio context session | ✓ done — see `2026-04-26 · INGEST · Audio reactive subsystem` in [[log]] |
| Mobile pass | next up |
| Dashboard chrome redesign | ✓ done — see [[Dashboard Explorer]] |
| Save-from-feed flow (unblocks `Guardados/`) | ✓ done |
| Foro (imageboard-style discussion) | ✓ done — see [[Foro]] |
| Backend / Supabase migration | deferred |

## Suggested first action — pick from these

Chunk 3 is closed. The remaining unblocked items are independent — pick whichever resonates.

### A. Mobile pass

Most-impactful next step for the visual MVP. The desktop layout is locked; mobile is untested. Verify on small viewports: home grid mosaic, vibe slider, calendar sidebar, all six overlays, [[SearchOverlay]] command bar, dashboard forms. Expect breakages in the multi-column layouts ([[ArticuloOverlay]] sticky TOC, dashboard live preview side-pane) and the data-strip ticker.

**Where to start:** open the home page in a phone viewport, screenshot what breaks, then triage by severity. Probably need a `useMediaQuery` hook or container queries somewhere.

### B. Multi-platform embed widgets

The audio subsystem ships with a generic `EmbedWidget` interface in `components/audio/types.ts`. SoundCloud is implemented (`useSoundCloudWidget`); the same shape is waiting for:

- **YouTube** — IFrame Player API (`https://www.youtube.com/iframe_api`). Common path; needed for any mix that's only on YT.
- **Mixcloud** — Mixcloud.js Widget API. Important since Mixcloud is heavily used for DJ sets.
- **Spotify** — Embed iframe API. Lower priority (Spotify rarely hosts DJ-style mixes).
- **Bandcamp** — no JS widget API. Will need a fallback "open in source" path for Bandcamp-only mixes (transport disabled for that platform).

**Where to start:** copy `useSoundCloudWidget.ts` to `useYouTubeWidget.ts`, swap the API binding (YT requires `enablejsapi=1` on the iframe URL and uses event polling instead of PLAY_PROGRESS), and add a `useEmbedWidget(item)` resolver that picks the right hook by platform. `AudioPlayerProvider` then dispatches via the resolver instead of hard-coding SC.

### Smaller polish items (any session)

- **Tailwind `base` color rename** — patched locally in [[MixOverlay]]; root fix still pending. See [[Open Questions]].
- **Reduced-motion respect** — pending-publish glitch + CRT scanline + chip-pulse all run regardless of `prefers-reduced-motion`. WCAG-relevant; ~30 min of conditional CSS.
- **Confirmation modal copy on edit** — modal still says "una vez publicado…" when re-publishing already-published items. See "Open design questions" below.
- **Brand page copy** — when the team writes finished prose, replace `[REDACTAR]` markers in [[About]], [[Manifesto]], [[Equipo]].

## Open design questions to flag

- **Save affordance shape.** Bookmark icon? Heart? Terminal-style chip? Has to read in the dim header palette but be discoverable. Same gesture probably belongs in card thumbnails AND inside the overlay header — verify it makes sense in both contexts before committing.
- **Attendance verification.** Long-horizon — the Guardados/perks roadmap depends on a verifiable "I was there" gesture. User flagged this as the load-bearing problem, not the perk catalog. Possibilities: door-staff QR scan, NFC tap at venue, partner-issued one-time codes. Decision deferred until partnership conversations actually start.
- **Confirmation modal copy on edit.** When editing an already-published item and re-publishing, the modal still says "una vez publicado…" as if it's first-publish. Could refine to "una vez actualizado, los cambios serán visibles…" when `isPublished` is true.
- **Drafts list delete confirmation.** Currently single-click delete. Fine for prototype; for production add a confirm dialog or soft-delete with undo. Worth noting as a polish item.
- **Editing a published item momentarily flips state to draft** during the pending re-confirmation. Mentioned in Chunk 2 verification report. If editor cancels mid-flow, item shows as draft. Acceptable for prototype; worth deciding later whether to preserve "published" status during pending re-confirmations.

## Open questions inherited

- See [[Open Questions]] for the full list.
- The **Tailwind `base` color collision** spawned task is still pending — patched locally in [[MixOverlay]] but the root rename hasn't happened.
- **Reduced motion respect** — pending-publish glitch animations + CRT scanline + exit-fade all run regardless of `prefers-reduced-motion`. WCAG-relevant; worth a focused a11y pass eventually.

## How to start

Boot the preview (`npm run dev` or via `.claude/launch.json` "dev" config). Login with `admin / admin`. Verify Chunks 1+2 still feel right by:
1. Compose a draft from the dashboard, watch it autosave
2. Publish → see the pending card glitch on home → corner button → modal → confirm
3. Edit a published item from the drafts list
4. Try invalid submit (clear required fields) → see `⚠ FALTA: …` chip

Then pick from A / B / smaller polish items above. They're all independent.

For the foro: open `/foro`, drag the vibe slider to verify the catalog filters, click a tile to verify thread overlay + backlinks, log in via `admin / admin` and start a thread (image + 1–5 genres required) to verify session id format `fr-s01` and bump-to-top behavior.

## Don't forget

- **Append to [[log]] as you go.** Last session's catch-up was painful because logging drifted. Write entries as work closes, not after.
- **Update [[Open Questions]]** when an item closes.
- **Update [[index]]** when a new note is added.
- Don't introduce engagement metrics, don't sort home feed by `publishedAt`, don't put partners in the main grid (see [[CLAUDE.md]]).
