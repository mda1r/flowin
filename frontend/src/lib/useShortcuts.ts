import { useEffect, useRef } from 'react'

export interface Shortcut {
  // Key combos as KeyboardEvent.key, optionally prefixed with "Ctrl+", e.g. "F9", "/", "Ctrl+Enter".
  keys: string[]
  label: string
  run: () => void
  // Function keys stay active while typing; character keys like "/" or "+" do not.
  allowInInputs?: boolean
  enabled?: boolean
}

const isTyping = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

const comboOf = (e: KeyboardEvent) => `${e.ctrlKey || e.metaKey ? 'Ctrl+' : ''}${e.key}`

// Registers page-level shortcuts. They pause while any dialog is open so they never act behind it.
export function useShortcuts(shortcuts: Shortcut[]) {
  const ref = useRef(shortcuts)
  ref.current = shortcuts

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.altKey) return
      if (document.querySelector('[role="dialog"]')) return
      const combo = comboOf(e)
      const shortcut = ref.current.find((s) => s.enabled !== false && s.keys.includes(combo))
      if (!shortcut) return
      if (isTyping(e.target) && !shortcut.allowInInputs) return
      e.preventDefault()
      shortcut.run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
