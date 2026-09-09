# Pliego desktop refinement

Approved and implemented 2026-09-09 following the desktop direction-02 review.

## Visual and structural contract

Preserve the large identity spine, canonical trophies, private HP, role-gated spaces, all panel modules and customizable layout. Keep warm paper, ink rules, existing fonts, acid actions and the existing spectrum. Generated proposals guide composition; their sample metadata and substituted icons are not production assets.

## Implemented interaction changes

- Cultivar: real-cover selector, stable selection by item ID, whole active artwork, separate open-piece action and a short explanation of circulation versus harvest. Harvest confirmation and reconciliation are preserved.
- Reproductor: optional expanded paper sheet with cover gallery, EXPLORANDO selection and independent transport. The current audio stays in a fixed sheet footer while browsing. Unsupported sources retain external links. The full-width fader adds a scale and legend without changing voting, drag commitment, aggregate thresholds or detent motion.
- Panel editing: dedicated header handles, arrow-key moves, inert content controls during editing, and an allowed-size picker with geometric previews. Size choices retain the existing layout schema and single commit path.
- Trophies: pointer and keyboard inspection of canonical glyphs with named unlock conditions.
- Guardados: AMPLIAR PANEL explains the geometry change; REDUCIR restores the prior size in the current session, or the default after reload. Mixes remain in Reproductor.
- Agenda: GUARDADOS PASADOS describes past saved events without asserting attendance.
- Activity: individual rows become seen only after 75% exposure for two seconds in a visible tab. Both unread badges share this rule. Explicit MARCAR TODO VISTO retains the legacy watermark. Per-row state remains private, local and account-namespaced; later aggregation updates become unread again.
- Drafts: incomplete work can be explicitly saved. Save acknowledgement waits for the server; failure keeps the editor and input intact. Continue-later waits for success and stays open if edits arrived during the request. Publishing retains its complete-field validation and existing confirmation.

## Verification

Desktop Chrome checks covered cover selection, source-specific player actions, real SoundCloud playback while browsing another cover, pause, panel-size selection using the keyboard, Escape, trophy focus and Guardados expansion/reduction. Playback was paused and tab capture stopped afterward. The local lab uses fixture slices and does not establish authenticated production persistence.

The dashboard regression suite includes activity-exposure and draft-save success/failure cases. No public metrics, new backend schema, feed personalization or mobile redesign is introduced.

## Player density correction

The compact player uses a 36px paper transport row, then collection navigation above the selected cover. Arrows stay visible and disable honestly for a single mix. Two-row panels use a 48px cover and offer the fader through Expandir; three-row panels retain the full-width fader. Compact readouts truncate instead of adding a line that breaks the fixed widget budget. Current playback remains independent of the browsed mix. The expanded transport remains dark and persistent.
