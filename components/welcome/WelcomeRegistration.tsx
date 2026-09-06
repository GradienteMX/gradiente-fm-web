// Fine registration marks sit independently of the animated print field.
export function WelcomeRegistration() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      <svg className="h-full w-full" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" fill="none">
        <g stroke="#dbe3aa" strokeWidth="0.7" opacity="0.45">
          <circle cx="170" cy="-30" r="310" />
          <circle cx="1500" cy="90" r="390" />
          <circle cx="1280" cy="840" r="330" />
          <path d="M-130 370 C250 300 180 960 870 1060" />
        </g>
        <g stroke="#333d36" strokeWidth="1" opacity="0.7">
          <path d="M440 360h22m-11-11v22M965 590h22m-11-11v22" />
        </g>
      </svg>
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,#1111110a_3px,#1111110a_4px)]" />
    </div>
  )
}
