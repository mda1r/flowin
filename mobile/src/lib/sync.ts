import NetInfo, { type NetInfoState as _NetInfoState } from '@react-native-community/netinfo'
import { getUnsyncedOrders, markOrderSynced } from './db'
import { ordersApi } from '@/api/index'

let syncInProgress = false

export async function syncOfflineOrders(): Promise<{ synced: number; failed: number }> {
  if (syncInProgress) return { synced: 0, failed: 0 }

  const netState = await NetInfo.fetch()
  if (!netState.isConnected) return { synced: 0, failed: 0 }

  syncInProgress = true
  let synced = 0
  let failed = 0

  try {
    const pending = await getUnsyncedOrders()
    for (const order of pending) {
      try {
        // Create the order on the server
        const { data: created } = await ordersApi.createOrder(order.branchId, {
          tenantId: order.tenantId,
          currency: 'SAR',
          customerId: order.customerId,
          taxRate: 0.15,
        })

        // Add lines
        for (const line of order.lines) {
          await ordersApi.addLine(order.branchId, created.id, line)
        }

        // Complete
        await ordersApi.complete(order.branchId, created.id, {
          paymentMethod: order.paymentMethod as 'Cash' | 'Card' | 'Split',
          amountTendered: order.amountTendered,
          cashAmount: order.cashAmount,
          cardAmount: order.cardAmount,
        })

        await markOrderSynced(order.id)
        synced++
      } catch {
        failed++
      }
    }
  } finally {
    syncInProgress = false
  }

  return { synced, failed }
}
