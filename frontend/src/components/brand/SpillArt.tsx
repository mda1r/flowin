import { useId } from 'react'
import { cn } from '@/lib/utils'

/* A hand-inked mug on its side whose spill is the brand's mint flow, with a small sprout growing out of it:
   the café, the flow and growth in one drawing. Lines take currentColor (graphite on light, soft white on
   graphite); a turbulence filter gives them a slightly wobbly pen edge. The spill pours in once on load. */
export function SpillArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  const ink = `${id}-ink`
  const mouth = `${id}-mouth`
  return (
    <svg viewBox="30 40 470 175" className={cn('spill-art', className)} aria-hidden="true">
      <defs>
        <filter id={ink} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="2.6" />
        </filter>
        {/* the inside of the mug's mouth, so the coffee left in it stays within the rim */}
        <clipPath id={mouth}>
          <ellipse cx="152" cy="131" rx="15" ry="37" />
        </clipPath>
      </defs>

      <g filter={`url(#${ink})`}>
        {/* the spill: pours from the mug's mouth and runs off as the flow */}
        <g className="spill-pour">
          <path
            d="M150 150c18 6 30 2 46-6 22-11 44-12 66-4 18 7 30 18 50 18 24 0 34-14 58-15 22-1 30 12 52 11 20-1 36-6 52-6v8
               c-16 0-30 6-50 8-24 2-34-10-54-8-22 2-32 18-60 18-24 0-38-12-56-18-18-6-38-6-58 4-18 9-34 14-50 8z"
            fill="rgb(var(--brand))"
          />
          <path d="M226 172c14 2 26 8 24 16-2 7-20 8-30 4-11-4-9-21 6-20z" fill="rgb(var(--brand))" />
          <path d="M452 176c10-2 22 1 24 6 1 5-9 8-19 7-10-1-14-11-5-13z" fill="rgb(var(--brand))" className="spill-drop" />
          {/* highlights on the wet edge */}
          <g fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.75">
            <path d="M206 152c10-5 20-7 30-7" />
            <path d="M330 160c8 0 14-3 20-6" />
            <path d="M228 186c6 1 12 0 16-2" />
          </g>
        </g>

        {/* the mug, lying on its side and tipped a little toward the spill */}
        <g fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-9 150 150)">
          <path d="M152 92 74 90c-16 0-26 12-26 28v24c0 16 10 28 26 28l78-2" fill="rgb(var(--surface))" />
          <ellipse cx="152" cy="131" rx="17" ry="39" fill="rgb(var(--surface-2))" />
          <path d="M146 100c-5 8-7 20-6 32" strokeWidth="2.5" opacity="0.5" />
          {/* coffee still inside, pooled at the low side of the mouth */}
          <path d="M126 147c12-5 26 0 50-6v42h-50z" fill="rgb(var(--brand))" stroke="none" clipPath={`url(#${mouth})`} />
          {/* …and pouring over the lip onto the counter, where it joins the flow */}
          <path
            d="M148 158c7-6 15-6 20 0 6 8 8 16 20 19 10 3 20 1 30 3v9c-14 0-28 1-42-3-14-4-24-11-28-28z"
            fill="rgb(var(--brand))"
            stroke="none"
          />
          <path d="M157 157c4-2 8-2 11 1" stroke="#fff" strokeWidth="2" opacity="0.75" />
          {/* handle */}
          <path d="M80 170c-8 22 0 36 18 35 15-1 21-14 15-36" />
          <path d="M91 171c-3 13 2 21 8 20 6 0 9-8 5-20" strokeWidth="3.5" />
        </g>

        {/* a sprout growing from the spill */}
        <g className="spill-sprout" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M300 160c0-16 2-30 8-44" fill="none" />
          <path d="M306 128c-14-2-24-10-26-22 13 0 24 8 26 22z" fill="rgb(var(--brand))" />
          <path d="M309 118c6-14 18-20 30-18-3 12-14 19-30 18z" fill="rgb(var(--brand))" />
        </g>
      </g>
    </svg>
  )
}
