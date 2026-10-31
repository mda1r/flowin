import { useEffect, useRef, useState } from 'react'
import { AlarmClock } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import {
  WARNING_SECONDS,
  formatClock,
  playAlarmSequence,
  playBeep,
  sendGameNotification,
  sessionSecondsLeft,
} from '@/lib/gamingAlerts'
import type { GameStationResponse } from '@/types/api'

interface GamingTimeAlertsProps {
  stations: GameStationResponse[]
  onCountsChange: (counts: { expired: number; warning: number }) => void
  onOpenGaming: () => void
  showBanner: boolean
}

interface Overdue {
  sessionId: string
  stationName: string
  playerName: string
  overSeconds: number
}

// Watches timed sessions on its own one-second clock (so the cashier page does not re-render every second),
// alerts once per session at five minutes left and at time-up, and shows a banner while any session is overdue.
export function GamingTimeAlerts({ stations, onCountsChange, onOpenGaming, showBanner }: GamingTimeAlertsProps) {
  const [overdue, setOverdue] = useState<Overdue[]>([])
  const warned = useRef(new Set<string>())
  const expired = useRef(new Set<string>())
  const lastCounts = useRef({ expired: -1, warning: -1 })
  const stationsRef = useRef(stations)
  stationsRef.current = stations
  const onCountsRef = useRef(onCountsChange)
  onCountsRef.current = onCountsChange

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      const nextOverdue: Overdue[] = []
      let warning = 0

      for (const station of stationsRef.current) {
        const session = station.status === 'InUse' ? station.activeSession : undefined
        if (!session) continue
        const left = sessionSecondsLeft(session, now)
        if (left === null) continue

        if (left <= 0) {
          nextOverdue.push({ sessionId: session.sessionId, stationName: station.name, playerName: session.playerName, overSeconds: -left })
          if (!expired.current.has(session.sessionId)) {
            expired.current.add(session.sessionId)
            playAlarmSequence()
            sendGameNotification('انتهى وقت اللعب', `${station.name} · ${session.playerName}`)
            toast.warning('انتهى وقت اللعب', `${station.name} · ${session.playerName}`)
          }
        } else if (left <= WARNING_SECONDS) {
          warning++
          if (!warned.current.has(session.sessionId)) {
            warned.current.add(session.sessionId)
            playBeep(440, 0.3)
            toast.info('باقي ٥ دقائق', `${station.name} · ${session.playerName}`)
          }
        }
      }

      setOverdue(nextOverdue)
      if (lastCounts.current.expired !== nextOverdue.length || lastCounts.current.warning !== warning) {
        lastCounts.current = { expired: nextOverdue.length, warning }
        onCountsRef.current({ expired: nextOverdue.length, warning })
      }
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  if (!showBanner || overdue.length === 0) return null

  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
      <AlarmClock className="h-4 w-4 shrink-0 animate-pulse motion-reduce:animate-none" />
      <span className="min-w-0 flex-1">
        انتهى الوقت:{' '}
        {overdue.map((o, i) => (
          <span key={o.sessionId}>
            {i > 0 && '، '}
            <span className="font-semibold">{o.stationName}</span> ({o.playerName}) +<span className="tabular-nums">{formatClock(o.overSeconds)}</span>
          </span>
        ))}
      </span>
      <button
        type="button"
        onClick={onOpenGaming}
        className="rounded-lg border border-danger/40 px-3 py-1 text-xs font-semibold hover:bg-danger/10"
      >
        عرض الأجهزة
      </button>
    </div>
  )
}
