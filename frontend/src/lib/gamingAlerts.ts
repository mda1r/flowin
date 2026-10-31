import type { GameSessionSummary } from '@/types/api'

export const WARNING_SECONDS = 5 * 60

export function playBeep(frequency = 880, duration = 0.35) {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start()
    osc.stop(ctx.currentTime + duration)
    setTimeout(() => ctx.close(), (duration + 0.1) * 1000)
  } catch {
    // Audio can be blocked until the user interacts with the page; the visual alert still shows.
  }
}

export function playAlarmSequence() {
  playBeep(880, 0.3)
  setTimeout(() => playBeep(880, 0.3), 400)
  setTimeout(() => playBeep(1320, 0.4), 800)
}

export function sendGameNotification(title: string, body: string) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    void new Notification(title, { body, tag: 'gaming-time-up' })
  }
}

export function requestNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission()
  }
}

// Seconds left in a timed session (negative once overtime); null for sessions without a planned duration.
export function sessionSecondsLeft(session: GameSessionSummary, now: number): number | null {
  if (!session.durationMinutes || session.durationMinutes <= 0) return null
  const endMs = new Date(session.startTime).getTime() + session.durationMinutes * 60_000
  return Math.floor((endMs - now) / 1000)
}

export function formatClock(totalSeconds: number) {
  const sec = Math.abs(totalSeconds)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return h > 0 ? `${h}:${mmss}` : mmss
}
