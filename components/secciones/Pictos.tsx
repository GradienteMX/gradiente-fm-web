/**
 * Two pictograms the kit doesn't carry, drawn on its grid (20 units, 1.5
 * stroke, currentColor): «todo» — every format at once — and «campo» — the
 * mosaic itself.
 */

interface Props {
  size?: number
}

function Svg({ size = 16, children }: Props & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      {children}
    </svg>
  )
}

/** Four points gathered: every format. */
export function TodoGlyph({ size }: Props) {
  return (
    <Svg size={size}>
      <circle cx="5.5" cy="5.5" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="5.5" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="14.5" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="14.5" r="1.9" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** Cells of different sizes: the organism. */
export function CampoGlyph({ size }: Props) {
  return (
    <Svg size={size}>
      <rect x="2.75" y="2.75" width="8.5" height="8.5" />
      <rect x="13.25" y="2.75" width="4" height="4" />
      <rect x="13.25" y="8.75" width="4" height="8.5" />
      <rect x="2.75" y="13.25" width="8.5" height="4" />
    </Svg>
  )
}
