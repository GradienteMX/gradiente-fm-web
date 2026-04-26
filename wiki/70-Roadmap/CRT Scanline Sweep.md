---
type: roadmap
status: draft
tags: [animation, polish, terminal-aesthetic, crt, filter]
updated: 2026-04-25
---

# CRT Scanline Sweep

> Theatrical filter-change effect — a horizontal CRT-style scanline sweeps across the home grid when the category filter is applied or cleared. Pushes the "system is processing this for you" feel deeper into the terminal idiom.

## What

When [[CategoryRail]] flips `categoryFilter`, currently:
- Cards exit with opacity + scale (220ms easeIn, see [[ContentGrid]] AnimatePresence)
- Layout reflows via Framer's shared-layout animation
- [[FeedHeader]] swaps to the `//SUBSISTEMA · FILTRADO · X` line with a pulsing dot

This is enough that filtering no longer feels like a snap. But it could lean further into the EVA / NGE chrome we already use elsewhere ([[OverlayShell]] CRT boot-in, [[CRTOverlay]] global wrap). A horizontal scanline that sweeps the grid bounds — top-to-bottom over ~400ms — would make the filter change feel like a re-scan of the feed, in keeping with terminals that "redraw."

## Why

User feedback after the filter shipped (2026-04-25):

> "Looks great actually. Maybe add the CRT-style scanline sweep as a suggestion."

The polish isn't urgent — the current transition already reads as deliberate. But it would tighten the visual identity. Filter-change is exactly the moment where "the subsystem is doing something" — a scanline visualizes that work.

## How

Sketch — **not built yet**.

A single absolutely-positioned `<motion.div>` overlaid on the grid container, animated only when `categoryFilter` changes:

```tsx
// Inside ContentGrid (or a sibling overlay component)
const [sweepKey, setSweepKey] = useState(0)
useEffect(() => {
  // Trigger a fresh sweep on every categoryFilter change
  setSweepKey((k) => k + 1)
}, [categoryFilter])

return (
  <div className="relative" style={gridStyle}>
    <AnimatePresence>
      {/* Sweep — re-mounts on every key bump */}
      <motion.div
        key={sweepKey}
        className="pointer-events-none absolute inset-x-0 z-20 h-[3px]"
        style={{
          background: `linear-gradient(to bottom,
            transparent,
            rgba(249,115,22,0.45) 50%,
            transparent)`,
          boxShadow: '0 0 12px rgba(249,115,22,0.55), 0 0 24px rgba(249,115,22,0.25)',
        }}
        initial={{ top: 0, opacity: 0.9 }}
        animate={{ top: '100%', opacity: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      />
    </AnimatePresence>

    {/* …existing AnimatePresence + grid items… */}
  </div>
)
```

## Open design questions

- **Color** — orange (sys chrome) reads as "system action." Should it instead pick up the **active category's color** (cyan for mix, red for evento, etc.), so each filter has its own visual signature? Could be more expressive but might dilute the "system" framing.
- **Direction** — top-to-bottom feels canonical for CRT. Bottom-to-top might feel more "incoming feed" — a vertical signature for "fresh data arrived." Bias: top-to-bottom unless we want to lean into the radio metaphor.
- **Trigger scope** — only on category filter changes, or also on vibe slider changes / date filter changes? Probably only category for now (the slider is continuous; firing the sweep on every drag step would be noise). Date filter via [[CalendarSidebar]] could plausibly trigger one too.
- **Reduced motion** — respect `prefers-reduced-motion` and skip. Same for the existing exit animations — worth a global audit.
- **Stacking with the existing global [[CRTOverlay]]** — make sure the sweep sits below any global scanline so it doesn't double-flash.

## Related

- [[CategoryRail]] — what fires the filter change
- [[ContentGrid]] — where the sweep would mount
- [[FeedHeader]] — the existing reactive feedback for filter changes
- [[CRT Shader Layer]] — the larger CRT-effects roadmap; this is a small, targeted variant
- [[Overlay System]] — uses similar CRT boot-in for overlay open

## Effort estimate

~30 minutes for a baseline. Most of the work is choosing color / direction / interaction with existing animations. Code itself is one component or one local hook.
