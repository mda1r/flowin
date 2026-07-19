import { apiClient } from './client'
import type {
  SupplierResponse,
  PurchaseOrderResponse,
  PurchaseOrderStatus,
} from '@/types/api'

export const purchasingApi = {
  // Suppliers
  listSuppliers: (
    tenantId: string,
    params?: { page?: number; pageSize?: number },
  ) =>
    apiClient.get<SupplierResponse[]>(`/api/v1/tenants/${tenantId}/suppliers`, {
      params: { pageSize: 50, ...params },
    }),

  createSupplier: (
    tenantId: string,
    data: {
      name: string
      contactEmail?: string
      contactPhone?: string
      address?: string
    },
  ) =>
    apiClient.post<SupplierResponse>(`/api/v1/tenants/${tenantId}/suppliers`, data),

  // Purchase Orders
  listPurchaseOrders: (
    branchId: string,
    params?: {
      status?: PurchaseOrderStatus
      supplierId?: string
      page?: number
      pageSize?: number
    },
  ) =>
    apiClient.get<PurchaseOrderResponse[]>(
      `/api/v1/branches/${branchId}/purchase-orders`,
      { params: { pageSize: 20, ...params } },
    ),

  getPurchaseOrder: (branchId: string, orderId: string) =>
    apiClient.get<PurchaseOrderResponse>(
      `/api/v1/branches/${branchId}/purchase-orders/${orderId}`,
    ),

  createPurchaseOrder: (
    branchId: string,
    data: {
      tenantId: string
      supplierId: string
      expectedDelivery?: string
      notes?: string
    },
  ) =>
    apiClient.post<PurchaseOrderResponse>(
      `/api/v1/branches/${branchId}/purchase-orders`,
      data,
    ),

  addLine: (
    branchId: string,
    orderId: string,
    data: { variantId: string; description: string; quantity: number; unitCost: number },
  ) =>
    apiClient.post<PurchaseOrderResponse>(
      `/api/v1/branches/${branchId}/purchase-orders/${orderId}/lines`,
      data,
    ),

  removeLine: (branchId: string, orderId: string, lineId: string) =>
    apiClient.delete(
      `/api/v1/branches/${branchId}/purchase-orders/${orderId}/lines/${lineId}`,
    ),

  send: (branchId: string, orderId: string) =>
    apiClient.post<PurchaseOrderResponse>(
      `/api/v1/branches/${branchId}/purchase-orders/${orderId}/send`,
    ),

  receive: (branchId: string, orderId: string) =>
    apiClient.post<PurchaseOrderResponse>(
      `/api/v1/branches/${branchId}/purchase-orders/${orderId}/receive`,
    ),

  cancel: (branchId: string, orderId: string) =>
    apiClient.post<PurchaseOrderResponse>(
      `/api/v1/branches/${branchId}/purchase-orders/${orderId}/cancel`,
    ),
}
