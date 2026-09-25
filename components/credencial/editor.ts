/**
 * The Taller's hold on the credencial: the binder and the UI around the card
 * live in the Taller; everything that happens ON the card is the card's.
 *
 * Coordinates are face coordinates: (x, y) over the printed card as that
 * face is seen, from its top-left corner — 0..1 on the card, and past it on
 * the case: a sticker's centre may sit anywhere inside the case's outline
 * (the editor clamps to it; the world accepts PLACEMENT_BLEED either side).
 * `rot` in radians, clockwise as seen; `scale` in PLACEMENT_SCALE.
 *
 * While `placing`: the copy follows the pointer on the face turned toward
 * you, held to the case's outline (drag on touch; a tap or click presses
 * it), the wheel or Q / E turn it (Ctrl + wheel scales), + / − or [ / ]
 * scale it, F takes it to the other face (the card turns), the arrow keys
 * nudge it (Shift: further), Enter presses it, Esc or a right-click cancels.
 * The card doesn't turn by hand while placing, and leans only a little
 * while an editor is attached (the face stays readable).
 *
 * Not placing: a press that travels turns the case by hand (to look at the
 * stickers wrapped round its edge or on the back; let go, it slings to a
 * face); hovering an applied sticker outlines it (ink ring, red
 * registration corners), a click picks it (`onPick(uid)`, marked in red; if
 * it sits on the other face the card turns to show it), a click on the
 * picked one or on the bare case lets go (`onPick(null)`); with nothing
 * picked, a click on the bare case turns the card as usual. A new
 * placement presses in (stepped settle) when the world adds it; a scrape
 * pass opens in steps.
 */
export interface CredencialEditor {
  /** A copy from the binder being placed, or null. */
  placing: { uid: string; stickerId: string } | null
  /** The user confirmed a spot (click / Enter). The parent confirms and dispatches `sticker-apply`. */
  onPlace(p: { face: 'frente' | 'dorso'; x: number; y: number; rot: number; scale: number }): void
  /** Esc / right-click while placing. */
  onCancel(): void
  /** An applied sticker (uid) was picked for scraping; null clears. */
  onPick(uid: string | null): void
  /** The currently picked applied sticker, highlighted on the card. */
  selected: string | null
}
