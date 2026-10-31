using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListStockMovements;

public sealed record ListStockMovementsQuery(
    Guid StockItemId,
    Guid BranchId,
    MovementType? Type = null,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null,
    int Page = 1,
    int PageSize = 25) : IQuery<StockMovementsPageResponse>;
