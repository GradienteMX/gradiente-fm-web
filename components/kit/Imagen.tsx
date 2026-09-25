/**
 * IMAGEN — next/image for art whose address people typed.
 *
 * Pieces, franjas and listings carry image URLs from anywhere. next/image
 * refuses — throws, taking the whole render down — any host outside
 * next.config.ts `remotePatterns`. Production learned this with its
 * SmartImage; this is the same rule as a drop-in: import it as `Image` and
 * nothing else at the call site changes.
 *
 *   optimizable  our Storage and the allow-listed CDNs, same-origin /public
 *                paths, not GIFs → resized and cached by the optimizer (what
 *                keeps Supabase egress down)
 *   anything else → served as it is (`unoptimized`): it isn't our egress,
 *                   and a GIF keeps its animation
 */

import type { ComponentProps } from 'react'
import NextImage from 'next/image'
import { isOptimizable } from '@/lib/imageHosts'

/** Same props as next/image (the ref included: React 19 passes it as a prop). */
export function Imagen(props: ComponentProps<typeof NextImage>) {
  const { src } = props
  // Static imports and data:/blob: addresses are next/image's own business.
  const own = typeof src !== 'string' || src.startsWith('data:') || src.startsWith('blob:')
  return <NextImage {...props} unoptimized={props.unoptimized || (!own && !isOptimizable(src))} />
}
