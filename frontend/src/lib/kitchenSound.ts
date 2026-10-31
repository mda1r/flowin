import { useCallback, useEffect, useRef, useState } from 'react'

// Audible cues for the kitchen screens. Browsers only allow sound after the screen has been tapped once,
// so the screens show a "tap to enable sound" control until then, plus a mute switch that is remembered.

const MUTE_KEY = 'flowin-kitchen-muted'

let ctx: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    ctx = null
  }
  return ctx
}

// Some kiosk browsers have no Web Audio at all; the screens then say so instead of asking for a tap.
export function kitchenSoundSupported() {
  return typeof window !== 'undefined'
    && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)
}

function tone(audio: AudioContext, at: number, frequency: number) {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.type = 'square'
  osc.frequency.setValueAtTime(frequency, at)
  gain.gain.setValueAtTime(0.3, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.25)
  osc.start(at)
  osc.stop(at + 0.25)
}

// A short run of beeps: loud enough to hear over a coffee machine, short enough not to annoy.
export async function kitchenBeep(times = 3) {
  const audio = audioContext()
  if (!audio) return
  // The context is suspended until a tap, and again after the tab spent a while in the background.
  if (audio.state === 'suspended') {
    try { await audio.resume() } catch { return }
  }
  if (audio.state !== 'running') return
  for (let i = 0; i < times; i++) {
    tone(audio, audio.currentTime + i * 0.35, i % 2 === 0 ? 880 : 1175)
  }
}

function readMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}

export function useKitchenSound() {
  const [enabled, setEnabled] = useState(() => ctx?.state === 'running')
  const [muted, setMuted] = useState(readMuted)
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  // The tap that unlocks audio must not also flip the mute switch that replaces the "enable" prompt.
  const unlockedAtRef = useRef(0)

  // Any tap on the screen unlocks audio for the rest of the session.
  useEffect(() => {
    if (enabled) return
    const unlock = () => {
      const audio = audioContext()
      if (!audio) return
      unlockedAtRef.current = performance.now()
      void audio.resume().then(() => setEnabled(audio.state === 'running')).catch(() => {})
    }
    document.addEventListener('pointerdown', unlock)
    document.addEventListener('keydown', unlock)
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [enabled])

  const toggleMute = useCallback(() => {
    if (performance.now() - unlockedAtRef.current < 1000) return
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    try { localStorage.setItem(MUTE_KEY, next ? '1' : '0') } catch { /* private mode */ }
    // Unmuting plays one beep so staff hear the volume they will get.
    if (!next) void kitchenBeep(1)
  }, [])

  const play = useCallback((times?: number) => {
    if (!mutedRef.current) void kitchenBeep(times)
  }, [])

  return { enabled, muted, toggleMute, play, supported: kitchenSoundSupported() }
}

// Fires `onArrive` when an order id appears that was not on the previous poll. The first load only records
// what is already on the board, so opening the screen does not ring for old orders; an empty board still rings.
export function useNewOrderAlert(ids: string[] | undefined, onArrive: (newIds: string[]) => void) {
  const seenRef = useRef<Set<string> | null>(null)
  const onArriveRef = useRef(onArrive)
  onArriveRef.current = onArrive
  const key = ids?.join(',')

  useEffect(() => {
    if (!ids) return
    const seen = seenRef.current
    seenRef.current = new Set(ids)
    if (!seen) return
    const fresh = ids.filter((id) => !seen.has(id))
    if (fresh.length > 0) onArriveRef.current(fresh)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

// Re-renders every `ms` so elapsed times and the clock keep moving between polls.
export function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}
