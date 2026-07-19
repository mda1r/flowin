// ZATCA Phase-1 QR code: TLV-encoded Base64
// Fields: seller name, VAT number, timestamp, total with VAT, VAT amount

export interface ZatcaQrData {
  sellerName: string
  vatNumber: string
  timestamp: string
  totalWithVat: number
  vatAmount: number
}

function encodeField(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder()
  const valueBytes = encoder.encode(value)
  const result = new Uint8Array(2 + valueBytes.length)
  result[0] = tag
  result[1] = valueBytes.length
  result.set(valueBytes, 2)
  return result
}

export function generateZatcaQr(data: ZatcaQrData): string {
  const fields = [
    encodeField(1, data.sellerName),
    encodeField(2, data.vatNumber),
    encodeField(3, data.timestamp),
    encodeField(4, data.totalWithVat.toFixed(2)),
    encodeField(5, data.vatAmount.toFixed(2)),
  ]

  const totalLength = fields.reduce((s, f) => s + f.length, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const f of fields) {
    merged.set(f, offset)
    offset += f.length
  }

  return btoa(String.fromCharCode(...merged))
}

export const SAUDI_VAT_RATE = 0.15
