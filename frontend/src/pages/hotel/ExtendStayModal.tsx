import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CalendarPlus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { hotelApi } from '@/api/hotel'
import { formatCurrency } from '@/lib/utils'
import type { ReservationResponse } from '@/types/api'
import { useI18n } from '@/i18n'
import { hotelErrorMessage, nightsUntil, stayTotals } from './stay'

// Day after the current check-out, as yyyy-mm-dd (UTC, like the server).
function nextDayYmd(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function ExtendStayModal({
  reservation,
  branchId,
  onClose,
  onSuccess,
}: {
  reservation: ReservationResponse | null
  branchId: string
  onClose: () => void
  onSuccess: (updated: ReservationResponse) => void
}) {
  const { t } = useI18n()
  const minYmd = reservation ? nextDayYmd(reservation.checkOut) : ''
  const [newDate, setNewDate] = useState(minYmd)

  useEffect(() => { setNewDate(minYmd) }, [minYmd])

  const valid = !!reservation && !!newDate && newDate >= minYmd
  const nights = valid ? nightsUntil(reservation.checkIn, newDate) : 0
  const totals = stayTotals(valid ? nights * reservation.ratePerNight : 0)

  const extend = useMutation({
    mutationFn: () =>
      hotelApi.extendReservation(branchId, reservation!.id, `${newDate}T00:00:00.000Z`),
    onSuccess: (response) => {
      onSuccess(response.data)
      onClose()
      toast.success(t.hotel.stayExtended, `${response.data.nights} ${t.hotel.nights}`)
    },
    onError: (err) => toast.error(t.hotel.extendStay, hotelErrorMessage(err)),
  })

  return (
    <Modal
      open={!!reservation}
      onClose={onClose}
      title={`${t.hotel.extendStay} — ${reservation?.guestName ?? ''}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button loading={extend.isPending} disabled={!valid} onClick={() => extend.mutate()}>
            <CalendarPlus className="h-4 w-4" />
            {t.hotel.extendStay}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={t.hotel.newCheckoutDate}
          type="date"
          min={minYmd}
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
        />
        {valid && (
          <div className="space-y-1 rounded-xl bg-surface-2 p-3 text-sm">
            <div className="flex justify-between text-muted">
              <span>{nights} {t.hotel.nights} × {formatCurrency(reservation.ratePerNight)}</span>
              <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>{t.hotel.vat}</span>
              <span className="tabular-nums">{formatCurrency(totals.vat)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-bold text-fg">
              <span>{t.hotel.totalWithVat}</span>
              <span className="tabular-nums">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
