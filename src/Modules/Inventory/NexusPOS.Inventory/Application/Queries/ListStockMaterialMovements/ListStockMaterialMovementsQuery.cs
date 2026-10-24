using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListStockMaterialMovements;

public sealed record ListStockMaterialMovementsQuery(Guid TenantId, Guid MaterialId)
    : IQuery<IReadOnlyList<StockMaterialMovementResponse>>;
