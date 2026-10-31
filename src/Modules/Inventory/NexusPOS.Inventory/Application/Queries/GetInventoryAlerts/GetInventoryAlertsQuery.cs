using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetInventoryAlerts;

// ExpiryDaysAhead overrides each item's own expiry notification window; null uses the per-item setting.
public sealed record GetInventoryAlertsQuery(
    Guid BranchId,
    int? ExpiryDaysAhead = null) : IQuery<InventoryAlertsResponse>;
