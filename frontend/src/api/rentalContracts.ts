import { apiClient } from './client'
import type { RentalContractResponse, ContractClauseDto } from '@/types/api'

const base = (branchId: string) => `/api/v1/branches/${branchId}/rental-contracts`

interface ContractPayload {
  tenantName: string
  tenantNationalId: string
  tenantPhone: string
  roomNumber: string
  startDate: string
  endDate: string
  monthlyRent: number
  landlordName: string
  clauses: ContractClauseDto[]
  reservationId?: string
  notes?: string
}

export const rentalContractsApi = {
  list: (branchId: string, page = 1, pageSize = 50) =>
    apiClient.get<RentalContractResponse[]>(base(branchId), { params: { page, pageSize } }),

  get: (branchId: string, contractId: string) =>
    apiClient.get<RentalContractResponse>(`${base(branchId)}/${contractId}`),

  create: (branchId: string, payload: ContractPayload) =>
    apiClient.post<RentalContractResponse>(base(branchId), payload),

  update: (branchId: string, contractId: string, payload: ContractPayload) =>
    apiClient.put<RentalContractResponse>(`${base(branchId)}/${contractId}`, payload),

  sign: (branchId: string, contractId: string) =>
    apiClient.post<RentalContractResponse>(`${base(branchId)}/${contractId}/sign`, {}),
}
