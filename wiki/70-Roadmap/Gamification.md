---
type: roadmap
status: draft
tags: [roadmap, gamification, hp, ideas]
updated: 2026-04-22
---

# Gamification

> User request: explore gamification. The site already has **HP** as a curation primitive — that's a head start.

## What's already game-like

- [[HP Curation System]] — items decay, `editorial: true` boosts spawn HP, events gain imminence bonus. Items **compete for grid real estate**.
- Card tiers (sm/md/lg) are visible HP brackets.
- The [[VibeSlider]] is a tuner. You move it, the world rearranges.

## Things that would turn the site game-ish (sorted by risk)

### Low risk — fits the editorial stance

1. **Live HP visualizer.** A small widget showing the current top 5 items' HP bars as decaying health bars — RPG style. [[NGE Aesthetic]] absorbs this trivially (it's EVA as hell).
2. **"Vibe streaks" on the slider** — pause at a vibe for N seconds and the slider remembers your "favorite range". Purely local; no account needed.
3. **Calendar → countdown cards.** When a high-HP event is within 48h, its card briefly gets a live `T-MM:HH` overlay. Already half-implemented in the curation (imminence bonus + live window).

### Medium risk — requires user state

4. **Bingo / achievement card** — "seen 5 events at Club Japan", "listened to 10 mixes", "visited during vibe 10". Needs localStorage at minimum; no accounts necessary.
5. **Personal vibe DNA** — aggregate the ranges the user lands on most. A private, post-browsing summary — never shown to others.
6. **Event check-in** — a QR or geofence that lets users confirm attendance, which feeds HP back to the event. See [[HP Curation System]] "HP boost on interaction" open question.

### High risk — could corrode editorial integrity

7. **Likes / upvotes on content** — ❌ explicitly rejected, see [[Size and Position as Only Signals]].
8. **User-visible "scene points" or leaderboards** — takes the spotlight off the culture and onto individual clout. Misaligns with "the curator's ear is the source of truth."
9. **Partner-linked rewards** — drags partners back into the main loop, undoing [[Partners Isolation]].

## Design principle (proposed)

> **Gamify the world, not the user.**
>
> Items can have HP, decay, streaks. Users can't rank each other or accumulate visible scores.

This is consistent with the site's existing philosophy ([[No Algorithm]]) and lets the HP system double as a game primitive without changing the editorial stance.

## Concrete first experiment

**"HP dashboard"** — a slide-in widget (like [[CalendarSidebar]] but from the right) that shows:
- Top 10 items right now with live HP bars
- Next 3 events, with countdown + current imminence bonus
- Last 3 items to fall off the home grid

Technical: uses existing [`rankItems`](../../lib/curation.ts) and [`currentHp`](../../lib/curation.ts), plus a 1s interval to re-render. Could ship in a week.

## Links

- [[HP Curation System]]
- [[Size and Position as Only Signals]]
- [[No Algorithm]]
- [[HTML-on-Canvas]]
- [[Open Questions]]
