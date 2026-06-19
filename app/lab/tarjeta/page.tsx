import { InviteExperience } from '@/components/welcome/invite3d/InviteExperience'
import type { InviteCard } from '@/lib/invitations'

export const metadata = { title: 'Invitación · spike · Gradiente' }
export const dynamic = 'force-static'

// Same Google Fonts the prototype's index.html loads, so canvas glyphs match
// the standalone exactly (Fraunces / IBM Plex Mono / Rajdhani / Space Grotesk).
const FONTS =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600;700&family=Rajdhani:wght@500;600;700&family=Space+Grotesk:wght@300;400;500&display=swap'

const DEMO: InviteCard = {
  name: 'Invitada Cero',
  code: 'GRDNT-2026-VLCN-0001',
  role: 'insider',
  folio: '001/150',
  issued: 'JUN 2026',
  partner: null,
  status: 'active',
}

// Full-viewport immersive preview. The fixed cockpit covers the app nav +
// VibeSlider so the experience previews exactly as it will on /welcome (which
// is itself a fixed inset-0 cockpit) — no surrounding chrome, no scroll.
export default function TarjetaSpikePage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FONTS} />
      <div className="fixed inset-0 z-[55] overflow-hidden bg-[#0D0D0D]">
        <InviteExperience invite={DEMO} />
      </div>
    </>
  )
}
