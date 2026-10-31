import { Volume2, VolumeX } from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

// Header control for the kitchen screens: asks for the one tap the browser needs before it can beep,
// then works as a mute switch.
export function KitchenSoundToggle({
  enabled,
  muted,
  onToggle,
  supported = true,
}: {
  enabled: boolean
  muted: boolean
  onToggle: () => void
  supported?: boolean
}) {
  const { t } = useI18n()

  if (!supported) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted">
        <VolumeX className="h-3.5 w-3.5" />
        {t.kitchen.soundUnsupported}
      </span>
    )
  }

  // Distinct keys: the toggle is a new element, so the click ending the unlocking tap cannot land on it.
  if (!enabled) {
    return (
      <button
        key="enable"
        type="button"
        className="flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-bold text-warning motion-safe:animate-pulse"
      >
        <VolumeX className="h-3.5 w-3.5" />
        {t.kitchen.enableSound}
      </button>
    )
  }

  return (
    <button
      key="toggle"
      type="button"
      onClick={onToggle}
      aria-pressed={!muted}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors',
        muted ? 'bg-danger/15 text-danger' : 'bg-surface-2 text-muted hover:text-fg',
      )}
    >
      {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      {muted ? t.kitchen.soundOff : t.kitchen.soundOn}
    </button>
  )
}
