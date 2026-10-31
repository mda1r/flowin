using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.AdjustStockMaterial;

public sealed record AdjustStockMaterialCommand(
    Guid TenantId,
    Guid MaterialId,
    decimal NewQuantity,
    string Reason) : ICommand<StockMaterialResponse>;
