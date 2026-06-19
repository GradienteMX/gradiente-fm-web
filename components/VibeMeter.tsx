import { VIBE_SLOT_COLORS, vibeRangeLabel, effectiveVibeBand, clsx } from '@/lib/utils'

// 11-segment stepped vibe meter — the canonical display for an item's vibe
// band. The full calibrated scale always renders (the printed plate); slots
// inside the band light at full slot color, slots outside dim to a low-alpha
// version of their own hue — unlit LEDs, never gray. Pure render,
// server-safe. Replaces the vibeBandGradient strips.
//
// The lit band is the EFFECTIVE band (crowd median once vibeCheckCount hits
// threshold, author range until then) — the same band filterByVibe admits
// and VibeFader displays at rest. A meter that disagreed with the filter
// that admitted the card would be a false readout.

export type VibeMeterSize = 'xs' | 'sm' | 'md'

// Thickness per variant: xs = card chrome, sm = card strips, md = overlay
// headers. Length on the main axis is the parent's / className's business.
const H_SIZE: Record<VibeMeterSize, string> = {
  xs: 'h-[2px]',
  sm: 'h-1',
  md: 'h-1.5',
}
const V_SIZE: Record<VibeMeterSize, string> = {
  xs: 'w-[2px]',
  sm: 'w-1',
  md: 'w-1.5',
}

// '33' ≈ 20% — dim enough that the brand-orange overload slots read unlit,
// bright enough that each slot keeps its own hue on #0D0D0D. Calibrate in
// lockstep with VibeSlider's unlit tape dashes (opacity 0.16 there — slightly
// dimmer because the tape sits on bg-base, the meter over imagery).
const UNLIT_ALPHA = '33'

interface VibeMeterProps {
  // The item-ish shape effectiveVibeBand needs; pass the ContentItem.
  item: {
    vibeMin: number
    vibeMax: number
    vibeCheckCount?: number
    vibeCheckMedianMin?: number
    vibeCheckMedianMax?: number
  }
  size?: VibeMeterSize
  // Vertical stacks slot 0 at the top — matches the 180deg-rotated band
  // strip it replaces (HeroCard left edge). Needs a height from className
  // or the parent.
  vertical?: boolean
  className?: string
}

export function VibeMeter({
  item,
  size = 'sm',
  vertical = false,
  className,
}: VibeMeterProps) {
  const [bandMin, bandMax] = effectiveVibeBand(item)
  // Defensive clamp — crowd medians can hand back non-integers.
  const lo = Math.max(0, Math.min(10, Math.round(Math.min(bandMin, bandMax))))
  const hi = Math.max(0, Math.min(10, Math.round(Math.max(bandMin, bandMax))))
  const label = `VIBE · ${vibeRangeLabel({ vibeMin: lo, vibeMax: hi })}`

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={clsx(
        'flex gap-px',
        vertical ? `flex-col ${V_SIZE[size]}` : `w-full ${H_SIZE[size]}`,
        className,
      )}
    >
      {VIBE_SLOT_COLORS.map((color, slot) => (
        <span
          key={slot}
          className="min-h-0 min-w-0 flex-1"
          style={{
            backgroundColor:
              slot >= lo && slot <= hi ? color : `${color}${UNLIT_ALPHA}`,
          }}
        />
      ))}
    </div>
  )
}
