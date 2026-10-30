// Prints one element (a receipt, a kitchen ticket) instead of the whole screen. A copy goes into
// #print-root and index.css hides everything else while printing; parts marked data-no-print
// (share boxes, buttons) are left out of the copy.
//
// The page is sized to the receipt: as wide as the printer's roll (80 or 58 mm) and exactly as tall as
// the copy, so a thermal printer cuts one slip and "Save as PDF" shows a receipt, not an A4 sheet.
const PX_PER_MM = 96 / 25.4
const SIDE_MARGIN_MM = 4

export function printElement(source: Element | null, options?: { paperWidthMm?: number }) {
  if (!source) {
    window.print()
    return
  }

  document.getElementById('print-root')?.remove()
  document.getElementById('print-page-size')?.remove()

  const paper = options?.paperWidthMm ?? Number((source as HTMLElement).dataset?.paper || 80)
  const root = document.createElement('div')
  root.id = 'print-root'
  root.dir = source.closest('[dir]')?.getAttribute('dir') ?? document.documentElement.dir ?? 'rtl'
  root.dataset.paper = String(paper)
  root.style.width = `${paper - SIDE_MARGIN_MM * 2}mm`

  const copy = source.cloneNode(true) as HTMLElement
  copy.removeAttribute('id')
  copy.querySelectorAll('[data-no-print]').forEach((n) => n.remove())
  root.appendChild(copy)
  document.body.appendChild(root)

  // Measure off-screen with the same layout rules print uses, then fix the page to that size.
  root.classList.add('print-measuring')
  const heightMm = Math.ceil(root.scrollHeight / PX_PER_MM) + 6
  root.classList.remove('print-measuring')

  const pageSize = document.createElement('style')
  pageSize.id = 'print-page-size'
  pageSize.textContent = `@page { size: ${paper}mm ${heightMm}mm; margin: 0; }`
  document.head.appendChild(pageSize)
  document.body.classList.add('printing-element')

  const cleanup = () => {
    root.remove()
    pageSize.remove()
    document.body.classList.remove('printing-element')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}
