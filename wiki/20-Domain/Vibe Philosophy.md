---
type: domain
status: current
tags: [vibe, philosophy, design-thesis, core-concept]
updated: 2026-05-05
---

# Vibe Philosophy

> The four ideas that shape every decision involving vibes and genres. If a future change feels off but you can't articulate why, check it against these.

## What

Four ideas, layered. Each builds on the previous.

### 1. Two-axis system, not one

**Genre and vibe are independent and compose.** Genre is categorical (techno, dub, jazz, cumbia…). Vibe is continuous, 0 → 10. They don't collapse into each other — you filter by genre and you slide the vibe inside that genre. Two layers, not one.

This is why the home filter intersects: `vibe range ∩ category ∩ (any-of active genres)`. Each axis stays clean. See [[ContentGrid]] filter logic.

### 2. Genre alone is a lie

"Techno" tells you nothing about energy. There is hard techno and ambient techno. Dub can be a meditation or a soundsystem detonation. Jazz can be 3am cigarette music or a free-jazz wall of sound. The vibe spectrum is what fixes the lie — it lets you say "I want dub, but at a 7" or "I want jazz, but at a 2."

This is why every item carries a curator-assigned `[vibeMin, vibeMax]` and is filterable on both axes. It's also why the slider's chip strip mirrors the actual feed (see [[VibeSlider]]) instead of a `GENRE_VIBE` stereotype map — a "techno" item set at vibe 2 should make a `techno` chip appear in the chill area, because it's actually there.

### 3. The system learns context

Vibe values aren't isolated points. They accumulate context: this DJ tends to play harder, this venue tends to go softer, this promoter's lineups skew toward 6-7. Items remember their history; the system remembers patterns. Less and less analog correction is needed because the calibration sharpens with every interaction.

Two accumulation primitives so far:

- **[[Vibe Checks]]** — crowd median per item, threshold-gated. Live now.
- **Composer prior** — at compose time, pre-fill `vibeMin/vibeMax` from author / venue / genre history. **Not built yet** — see [[Open Questions]].

### 4. Grading is the engagement primitive

A vibe check should feel as casual as a save or like on other platforms — the cultural register of "this is just how you engage here." But it's *not* a like. A like is acknowledgment; a vibe check is a positioned reading. The act contributes real information: where you put the fader is data.

The fader's drag-to-set physicality is the friction that makes the data trustworthy. Tap-to-agree would dump every passive scroller into the median. Slide-and-release filters out everyone who isn't actually paying attention. The friction is the design, not a defect.

## Why these four matter together

Each one alone is incomplete:

- 1 without 2 = two filters but no reason for both.
- 2 without 3 = vibe is a snapshot, never improves.
- 3 without 4 = the learning system has no participation channel.
- 4 without 1+2 = grading without an axis to grade against.

Together they describe the whole loop: **two clean axes → vibe corrects what genre can't say → the crowd's vibe checks improve the calibration → the act of checking is the cultural primitive.**

## What this rules out

- **Auto-derived vibes.** No "compute vibe from genres + tempo + key." The curator's ear is the source; the crowd refines.
- **Genre = vibe substitution.** The chip strip is not "genres typically at vibe X" — it's "genres in the feed right now at vibe X." See [[VibeSlider]] §"Chip strip is feed-driven."
- **One-tap vibe checks.** The drag is the commitment. A tap-heart equivalent would defeat the data quality.
- **Personalized feeds based on vibe history.** See [[No Algorithm]] — the vibe shapes the *display* rule, not the per-user feed.

## Where it lands in the code

| Idea | Code surface |
|---|---|
| Two axes | [[VibeContext]] (`vibeRange` + `genreFilter`), [[ContentGrid]] (intersect filter) |
| Genre is a lie | [[VibeSlider]] chip strip = feed-driven (`visibleGenres`); [[genres]] taxonomy with leaves + parents (no auto-vibe) |
| System learns | [[Vibe Checks]] crowd median + threshold; composer prior pending |
| Grading as engagement | [[VibeFader]] (drag-to-set, gold ghost overlay, login-gated) |

## Links

- [[Vibe Spectrum]] — the 0-10 axis mechanics
- [[Vibe Checks]] — the crowd-aggregation feature that operationalizes idea 3+4
- [[VibeFader]] — the grading UI
- [[VibeSlider]] — the filtering UI
- [[genres]] — the taxonomy + rollup system that supports idea 1
- [[Guides Not Gatekeepers]] — sibling thesis on editorial vs. crowd
- [[No Algorithm]] — what we deliberately don't do
