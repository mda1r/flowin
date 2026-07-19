import { useEffect, useRef, useCallback } from 'react'

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void
  minLength?: number
  maxGapMs?: number
  active?: boolean
}

export function useBarcodeScanner({
  onScan,
  minLength = 4,
  maxGapMs = 80,
  active = true,
}: BarcodeScannerOptions) {
  const buffer = useRef<string>('')
  const lastKeyTime = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!active) return

      const target = e.target as HTMLElement
      const isTypingInInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      const now = Date.now()
      const gap = now - lastKeyTime.current
      lastKeyTime.current = now

      if (e.key === 'Enter') {
        if (buffer.current.length >= minLength) {
          const barcode = buffer.current
          buffer.current = ''
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          onScan(barcode)
          // Only prevent default if we detected a scanner (not user typing in a search field)
          if (!isTypingInInput) e.preventDefault()
        }
        buffer.current = ''
        return
      }

      // Reset buffer if gap is too long (human typing, not scanner)
      if (gap > maxGapMs && buffer.current.length > 0) {
        buffer.current = ''
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        buffer.current += e.key
      }

      // Auto-reset buffer after maxGapMs if Enter never arrives
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        buffer.current = ''
      }, maxGapMs * 3)
    },
    [active, minLength, maxGapMs, onScan],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [handleKeyDown])
}
