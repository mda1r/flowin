using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.UpdateStockMaterial;

public sealed record UpdateStockMaterialCommand(
    Guid TenantId,
    Guid MaterialId,
    string Code,
    string NameAr,
    string? NameEn,
    Guid? CategoryId,
    string StorageUnit,
    string ComponentUnit,
    decimal ConversionFactor,
    CostMethod CostMethod,
    decimal? ManualCost,
    decimal? ManualQuantity,
    decimal? MinLevel,
    decimal? MaxLevel,
    decimal? ReorderLevel) : ICommand<StockMaterialResponse>;
