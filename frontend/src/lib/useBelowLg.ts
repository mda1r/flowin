import { useEffect, useState } from 'react'

const BELOW_LG = '(max-width: 1023.98px)'

/** True below Tailwind's lg breakpoint, where the sidebar is an off-canvas drawer. */
export function useBelowLg() {
  const [below, setBelow] = useState(() => window.matchMedia(BELOW_LG).matches)
  useEffect(() => {
    const mq = window.matchMedia(BELOW_LG)
    const onChange = () => setBelow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return below
}
