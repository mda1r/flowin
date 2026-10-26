import { useId } from 'react'
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

/* The sprout: flowin's icon. Two mint leaves on an inked stem, drawn by hand like the dashboard art.
   Outlines take currentColor, so it reads graphite on light and soft white on graphite. */
export const SPROUT = {
  stem: 'M28.2 50.4C28 43 29 37.5 30.6 33.2c.5-2 1-3.7 1.8-5.6',
  leftLeaf: 'M14.3 22.2c5.7-1.7 12.2.8 15.4 10.4-5.7.4-12.7-3.6-15.4-10.4z',
  rightLeaf: 'M32.2 27.9c2.8-6.9 9.8-11.1 17.1-11.1-2.8 7.2-9.8 11.7-17.1 11.1z',
} as const

/** The app icon. `framed` draws it on a rounded tile in the surface colour, like the app-store icon. */
export function FlowinMark({ className, framed = true, inked = true }: { className?: string; framed?: boolean; inked?: boolean }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9', className)} role="img" aria-label="flowin">
      {inked && (
        <defs>
          <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="4" />
            <feDisplacementMap in="SourceGraphic" scale="0.9" />
          </filter>
        </defs>
      )}
      {framed && <rect width="64" height="64" rx="15" fill="rgb(var(--surface-2))" />}
      <g
        filter={inked ? `url(#${id})` : undefined}
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={framed ? undefined : 'translate(-1 -3) scale(1.1)'}
      >
        <path d={SPROUT.stem} fill="none" />
        <path d={SPROUT.leftLeaf} fill="rgb(var(--brand))" />
        <path d={SPROUT.rightLeaf} fill="rgb(var(--brand))" />
      </g>
    </svg>
  )
}

/** The mark beside the wordmark: how flowin signs the sidebar, the login page and the console. */
export function FlowinLockup({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} dir="ltr">
      <FlowinMark framed={false} className={cn('h-8 w-8 shrink-0 text-fg', markClassName)} />
      <FlowinLogo className="h-[24px] text-fg" />
    </span>
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
