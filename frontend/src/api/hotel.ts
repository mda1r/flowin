import { apiClient } from './client'
import type {
  RoomResponse,
  ReservationResponse,
  RoomType,
  RoomStatus,
} from '@/types/api'

const base = (branchId: string) => `/api/v1/branches/${branchId}/hotel`

export const hotelApi = {
  // ── Rooms (legacy endpoint — basic room management) ──────────────────────
  listRooms: (
    branchId: string,
    params?: { type?: string; status?: RoomStatus; page?: number; pageSize?: number },
  ) =>
    apiClient.get<RoomResponse[]>(`/api/v1/branches/${branchId}/rooms`, {
      params: { page: 1, pageSize: 500, ...params },
    }),

  getRoom: (branchId: string, roomId: string) =>
    apiClient.get<RoomResponse>(`/api/v1/branches/${branchId}/rooms/${roomId}`),

  // ── Hotel module endpoints ─────────────────────────────────────────────────

  /** Returns rooms enriched with active reservation + cleaning status */
  listHotelRooms: (branchId: string) =>
    apiClient.get<RoomResponse[]>(`${base(branchId)}/rooms`),

  createHotelRoom: (
    branchId: string,
    data: {
      tenantId: string
      roomType: RoomType
      roomNumber: string
      floor: number
      capacity: number
      nightlyRate: number
      currency: string
      description?: string
    },
  ) => apiClient.post<RoomResponse>(`${base(branchId)}/rooms`, data),

  checkIn: (
    branchId: string,
    roomId: string,
    data: {
      tenantId: string
      guestName: string
      guestNationalId: string
      guestPhone: string
      checkIn: string
      checkOut: string
      ratePerNight: number
      notes?: string
    },
  ) =>
    apiClient.post<ReservationResponse>(
      `${base(branchId)}/rooms/${roomId}/checkin`,
      data,
    ),

  checkOut: (branchId: string, reservationId: string) =>
    apiClient.post<ReservationResponse>(
      `${base(branchId)}/reservations/${reservationId}/checkout`,
    ),

  markClean: (branchId: string, roomId: string) =>
    apiClient.post<RoomResponse>(`${base(branchId)}/rooms/${roomId}/mark-clean`),

  markNeedsClean: (branchId: string, roomId: string) =>
    apiClient.post<RoomResponse>(`${base(branchId)}/rooms/${roomId}/mark-needs-clean`),

  listReservations: (branchId: string) =>
    apiClient.get<ReservationResponse[]>(`${base(branchId)}/reservations`),

  getCheckoutAlerts: (branchId: string) =>
    apiClient.get<ReservationResponse[]>(`${base(branchId)}/reservations/alerts`),

  // ── Legacy status/deactivate ───────────────────────────────────────────────
  setStatus: (branchId: string, roomId: string, data: { status: RoomStatus }) =>
    apiClient.patch<RoomResponse>(
      `/api/v1/branches/${branchId}/rooms/${roomId}/status`,
      { newStatus: data.status },
    ),

  deactivate: (branchId: string, roomId: string) =>
    apiClient.delete(`/api/v1/branches/${branchId}/rooms/${roomId}`),
}
