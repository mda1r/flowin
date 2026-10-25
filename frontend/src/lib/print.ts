// Prints one element (a receipt, a kitchen ticket) instead of the whole screen. A copy goes into
// #print-root and index.css hides everything else while printing; parts marked data-no-print
// (share boxes, buttons) are left out of the copy.
export function printElement(source: Element | null) {
  if (!source) {
    window.print()
    return
  }

  document.getElementById('print-root')?.remove()
  const root = document.createElement('div')
  root.id = 'print-root'
  root.dir = source.closest('[dir]')?.getAttribute('dir') ?? document.documentElement.dir ?? 'rtl'

  const copy = source.cloneNode(true) as HTMLElement
  copy.removeAttribute('id')
  copy.querySelectorAll('[data-no-print]').forEach((n) => n.remove())
  root.appendChild(copy)
  document.body.appendChild(root)
  document.body.classList.add('printing-element')

  const cleanup = () => {
    root.remove()
    document.body.classList.remove('printing-element')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}
