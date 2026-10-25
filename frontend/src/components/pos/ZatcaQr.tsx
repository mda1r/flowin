import { QRCodeSVG } from 'qrcode.react'

// Renders the ZATCA TLV QR locally as SVG, so invoice data never leaves the app and the code prints sharply.
// Always black on white: scanners need that contrast even when the app is in dark mode.
export function ZatcaQr({ value, size, label = 'رمز ZATCA للتحقق' }: { value: string; size: number; label?: string }) {
  return (
    <div className="rounded-lg bg-white p-1.5" role="img" aria-label={label}>
      <QRCodeSVG value={value} size={size} level="M" marginSize={0} bgColor="#FFFFFF" fgColor="#000000" title={label} />
    </div>
  )
}
