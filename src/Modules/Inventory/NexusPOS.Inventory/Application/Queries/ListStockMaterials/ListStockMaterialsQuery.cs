using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListStockMaterials;

public sealed record ListStockMaterialsQuery(
    Guid TenantId,
    Guid? CategoryId = null,
    bool LowStockOnly = false,
    string? Search = null) : IQuery<IReadOnlyList<StockMaterialResponse>>;
