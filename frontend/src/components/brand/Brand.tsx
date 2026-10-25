import { cn } from '@/lib/utils'

/* The flowin identity, drawn as monoline rounded strokes so it stays crisp at every size:
   graphite (or soft white on dark) letters, with the "o" and "i" in mint. */

const STROKE = 10

interface LogoProps {
  className?: string
  /** 'mono' draws every letter in currentColor, for receipts and print. */
  tone?: 'brand' | 'mono'
  title?: string
}

export function FlowinLogo({ className, tone = 'brand', title = 'flowin' }: LogoProps) {
  const mint = tone === 'brand' ? 'rgb(var(--brand))' : 'currentColor'
  return (
    <svg viewBox="0 0 220 64" className={cn('h-7 w-auto', className)} role="img" aria-label={title}>
      <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        {/* f */}
        <path d="M10 58V17a11 11 0 0 1 11-11h5" />
        <path d="M3 27h19" />
        {/* l */}
        <path d="M44 6v52" />
        {/* w */}
        <path d="M111 27l9.5 31 9.5-21 9.5 21 9.5-31" />
        {/* n */}
        <path d="M185 58V40a13 13 0 0 1 26 0v18" />
      </g>
      {/* o */}
      <circle cx="77.5" cy="42.5" r="15.5" fill="none" stroke={mint} strokeWidth={STROKE} />
      {/* i */}
      <path d="M167 30v28" fill="none" stroke={mint} strokeWidth={STROKE} strokeLinecap="round" />
      <circle cx="167" cy="10" r="6" fill={mint} />
    </svg>
  )
}

/** The app icon: the mint "o" and "i" on a graphite tile. */
export function FlowinMark({ className, framed = true }: { className?: string; framed?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9', className)} role="img" aria-label="flowin">
      {framed && <rect width="64" height="64" rx="16" fill="#23262D" />}
      <circle cx="25" cy="38" r="10.5" fill="none" stroke="#62E6C7" strokeWidth="7" />
      <path d="M46 32v16" stroke="#62E6C7" strokeWidth="7" strokeLinecap="round" />
      <circle cx="46" cy="19" r="4.75" fill="#62E6C7" />
    </svg>
  )
}

/* Two mint waves: the "flow" in THINK • TRANSFORM • FLOW. The track is twice as wide as the view and
   drifts by half its width, so the loop is seamless; reduced motion keeps it still. */
const WAVE = Array.from({ length: 8 }, (_, i) => `T${(i + 1) * 150} 30`).join(' ')

export function FlowWave({ className, animated = true, glow = true }: { className?: string; animated?: boolean; glow?: boolean }) {
  return (
    // ltr: the double-width track must start at the left edge in Arabic too, or the drift leaves a gap.
    <div className={cn('pointer-events-none overflow-hidden', className)} dir="ltr" aria-hidden="true">
      <svg viewBox="0 0 600 80" preserveAspectRatio="none" className={cn('h-full w-[200%]', animated && 'flow-wave-track')}>
        <g fill="none" stroke="rgb(var(--brand))" strokeLinecap="round" className={glow ? 'flow-wave-glow' : undefined}>
          <path d={`M0 30 Q37.5 12 75 30 ${WAVE}`} strokeWidth="5" transform="scale(0.5 1)" />
          <path d={`M0 30 Q37.5 12 75 30 ${WAVE}`} strokeWidth="5" opacity="0.55" transform="translate(-37.5 22) scale(0.5 1)" />
        </g>
      </svg>
    </div>
  )
}

/** THINK • TRANSFORM • FLOW */
export function BrandTagline({ className }: { className?: string }) {
  return (
    <p className={cn('brand-tagline', className)} dir="ltr">
      Think <b>•</b> Transform <b>•</b> Flow
    </p>
  )
}
