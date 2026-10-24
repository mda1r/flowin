using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetStockMaterial;

public sealed record GetStockMaterialQuery(
    Guid TenantId,
    Guid MaterialId) : IQuery<StockMaterialResponse>;
