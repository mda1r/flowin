import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { catalogApi } from '@/api/catalog'
import type { CategoryResponse } from '@/types/api'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { useI18n } from '@/i18n'

// The existing categories with their Arabic and English names, each saved on its own.
export function CategoryNamesEditor({ categories }: { categories: CategoryResponse[] }) {
  const { t } = useI18n()
  if (categories.length === 0) return null
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div>
        <p className="text-sm font-semibold text-fg">{t.products.currentCategories}</p>
        <p className="text-xs text-muted">{t.products.currentCategoriesHint}</p>
      </div>
      <ul className="max-h-72 space-y-2 overflow-y-auto pe-1">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </ul>
    </div>
  )
}

function CategoryRow({ category }: { category: CategoryResponse }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [name, setName] = useState(category.name)
  const [nameEn, setNameEn] = useState(category.nameEn ?? '')
  const changed = name.trim() !== category.name || nameEn.trim() !== (category.nameEn ?? '')

  const save = useMutation({
    mutationFn: () => catalogApi.updateCategory(category.id, { name: name.trim(), nameEn: nameEn.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success(t.products.categorySaved)
    },
    onError: (err: unknown) => toast.error(t.products.categoryFailed, apiErrorMessage(err)),
  })

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 p-2">
      <input
        className="input h-9 min-w-0 flex-1 basis-32"
        aria-label={t.products.categoryName}
        maxLength={128}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="input h-9 min-w-0 flex-1 basis-32"
        dir="ltr"
        placeholder={t.products.noEnglishName}
        aria-label={`${t.products.categoryNameEn}: ${category.name}`}
        maxLength={128}
        value={nameEn}
        onChange={(e) => setNameEn(e.target.value)}
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={!changed || !name.trim()}
        loading={save.isPending}
        onClick={() => save.mutate()}
        aria-label={`${t.common.save}: ${category.name}`}
      >
        <Check className="h-3.5 w-3.5" />
        {t.common.save}
      </Button>
    </li>
  )
}
