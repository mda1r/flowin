import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2 } from 'lucide-react'
import { catalogApi } from '@/api/catalog'
import type { ProductResponse } from '@/types/api'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { shrinkImage } from '@/lib/imageResize'
import { useI18n } from '@/i18n'

/** The product's photo in the edit form: saved the moment it is picked, apart from the rest of the form. */
export function ProductImagePicker({ product, onChange }: { product: ProductResponse; onChange: (p: ProductResponse) => void }) {
  const { t } = useI18n()
  const p = t.products
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const done = (updated: ProductResponse, message: string) => {
    // Keep the add-on groups the edit form is showing; the image endpoints do not send them back.
    onChange({ ...updated, modifierGroups: product.modifierGroups })
    qc.invalidateQueries({ queryKey: ['products'] })
    toast.success(message)
  }

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const blob = await shrinkImage(file)
      const { data } = await catalogApi.setProductImage(product.id, blob)
      done(data, p.imageSaved)
    } catch (err) {
      const unreadable = err instanceof Error && ['canvas', 'encode'].includes(err.message)
      toast.error(p.imageFailed, unreadable ? p.imageUnreadable : apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = useMutation({
    mutationFn: () => catalogApi.removeProductImage(product.id),
    onSuccess: ({ data }) => done(data, p.imageRemoved),
    onError: (err) => toast.error(p.imageFailed, apiErrorMessage(err)),
  })

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand-ink"
        aria-label={product.imageUrl ? p.changeImage : p.addImage}
      >
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-7 w-7" />
        )}
      </button>
      <div className="space-y-2">
        <p className="text-sm font-medium text-fg">{p.image}</p>
        <p className="text-xs text-muted">{p.imageHint}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
            <ImagePlus className="h-3.5 w-3.5" />
            {product.imageUrl ? p.changeImage : p.addImage}
          </Button>
          {product.imageUrl && (
            <Button type="button" size="sm" variant="ghost" loading={remove.isPending} onClick={() => remove.mutate()}>
              <Trash2 className="h-3.5 w-3.5 text-danger" />
              {p.removeImage}
            </Button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void upload(file)
        }}
      />
    </div>
  )
}

/** The photo in the new-product form: kept here until the product is created, then uploaded with it. */
export function PendingImagePicker({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  const { t } = useI18n()
  const p = t.products
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand-ink"
        aria-label={file ? p.changeImage : p.addImage}
      >
        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-7 w-7" />}
      </button>
      <div className="space-y-2">
        <p className="text-sm font-medium text-fg">{p.image}</p>
        <p className="text-xs text-muted">{p.imageHint}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => input.current?.click()}>
            <ImagePlus className="h-3.5 w-3.5" />
            {file ? p.changeImage : p.addImage}
          </Button>
          {file && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
              <Trash2 className="h-3.5 w-3.5 text-danger" />
              {p.removeImage}
            </Button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0]
          e.target.value = ''
          if (picked) onChange(picked)
        }}
      />
    </div>
  )
}
