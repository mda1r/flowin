using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetInventoryAlerts;

public sealed record GetInventoryAlertsQuery(
    Guid BranchId,
    int ExpiryDaysAhead = 7) : IQuery<InventoryAlertsResponse>;
