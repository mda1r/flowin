import { apiClient } from './client'
import type {
  GameStationResponse,
  GameSessionResponse,
  GameSessionBillResponse,
} from '@/types/api'

const BASE = (branchId: string) => `/api/v1/branches/${branchId}/gaming`

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
    data: { playerName: string; durationMinutes: number; ratePerHour: number },
  ) =>
    apiClient.post<GameStationResponse>(
      `${BASE(branchId)}/stations/${stationId}/start`,
      data,
    ),

  // ── Sessions ────────────────────────────────────────────────────────────

  listActiveSessions: (branchId: string) =>
    apiClient.get<GameSessionResponse[]>(`${BASE(branchId)}/sessions/active`),

  extendSession: (branchId: string, sessionId: string, extraMinutes: number) =>
    apiClient.post<GameStationResponse>(
      `${BASE(branchId)}/sessions/${sessionId}/extend`,
      { extraMinutes },
    ),

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
