// Shrinks a picked photo before upload: at most 1280px on its longest side, re-encoded as JPEG.
// Phone photos are often 4-8 MB; WhatsApp shows offers at about this size anyway.
export async function compressImage(file: File, maxSide = 1280, quality = 0.85): Promise<{ base64: string; contentType: string; dataUrl: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  // JPEG has no transparency; paint white so transparent PNGs don't turn black.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), contentType: 'image/jpeg', dataUrl }
}
