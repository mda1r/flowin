using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.ReceiveStockMaterial;

public sealed record ReceiveStockMaterialCommand(
    Guid TenantId,
    Guid MaterialId,
    decimal Quantity,
    decimal UnitCost,
    string? Note) : ICommand<StockMaterialResponse>;
