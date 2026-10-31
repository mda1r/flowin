using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.RestoreStockMaterial;

public sealed record RestoreStockMaterialCommand(
    Guid TenantId,
    Guid MaterialId) : ICommand<StockMaterialResponse>;
