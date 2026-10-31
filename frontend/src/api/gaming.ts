import { apiClient } from './client'
import type {
  GameStationResponse,
  GameSessionResponse,
  GameSessionBillResponse,
  GamingPackageResponse,
  StationType,
} from '@/types/api'

const BASE = (branchId: string) => `/api/v1/branches/${branchId}/gaming`

export interface CompletedSessionResponse {
  id: string
  stationId: string
  stationName: string
  playerName: string
  startTime: string
  endTime: string
  actualMinutes: number
  totalAmount: number
  paymentMethod?: 'Cash' | 'Card'
  paidAt?: string
}

export const gamingApi = {
  // ── Stations ────────────────────────────────────────────────────────────

  listStations: (
    branchId: string,
    params?: { stationType?: string; status?: string; page?: number; pageSize?: number },
  ) =>
    apiClient.get<GameStationResponse[]>(`${BASE(branchId)}/stations`, {
      params: { page: 1, pageSize: 100, ...params },
    }),

  getStation: (branchId: string, stationId: string) =>
    apiClient.get<GameStationResponse>(`${BASE(branchId)}/stations/${stationId}`),

  createStation: (
    branchId: string,
    data: {
      tenantId: string
      stationType: string
      name: string
      hourlyRate: number
      currency: string
    },
  ) => apiClient.post<GameStationResponse>(`${BASE(branchId)}/stations`, data),

  startSession: (
    branchId: string,
    stationId: string,
    data: { playerName: string; durationMinutes: number; ratePerHour: number; packageId?: string },
  ) =>
    apiClient.post<GameStationResponse>(
      `${BASE(branchId)}/stations/${stationId}/start`,
      data,
    ),

  // ── Sessions ────────────────────────────────────────────────────────────

  listCompletedSessions: (branchId: string, from: string, to: string) =>
    apiClient.get<CompletedSessionResponse[]>(`${BASE(branchId)}/sessions/completed`, { params: { from, to } }),

  listActiveSessions: (branchId: string) =>
    apiClient.get<GameSessionResponse[]>(`${BASE(branchId)}/sessions/active`),

  extendSession: (branchId: string, sessionId: string, extraMinutes: number) =>
    apiClient.post<GameStationResponse>(
      `${BASE(branchId)}/sessions/${sessionId}/extend`,
      { extraMinutes },
    ),

  listPackages: (branchId: string) => apiClient.get<GamingPackageResponse[]>(`${BASE(branchId)}/packages`),

  createPackage: (branchId: string, data: { name: string; durationMinutes: number; price: number; stationType?: StationType }) =>
    apiClient.post<GamingPackageResponse>(`${BASE(branchId)}/packages`, data),

  deletePackage: (branchId: string, packageId: string) => apiClient.delete(`${BASE(branchId)}/packages/${packageId}`),

  paySession: (branchId: string, sessionId: string, paymentMethod: 'Cash' | 'Card') =>
    apiClient.post<GameSessionBillResponse>(`${BASE(branchId)}/sessions/${sessionId}/pay`, { paymentMethod }),

  endSessionById: (branchId: string, sessionId: string) =>
    apiClient.post<GameSessionBillResponse>(
      `${BASE(branchId)}/sessions/${sessionId}/end`,
    ),

  // ── Legacy (game-stations endpoint) ─────────────────────────────────────

  setMaintenance: (branchId: string, stationId: string) =>
    apiClient.post<GameStationResponse>(
      `${BASE(branchId)}/stations/${stationId}/maintenance`,
    ),
}
