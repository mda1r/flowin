using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.CreateStockMaterial;

public sealed record CreateStockMaterialCommand(
    Guid TenantId,
    string Code,
    string NameAr,
    string? NameEn,
    Guid? CategoryId,
    string StorageUnit,
    string ComponentUnit,
    decimal ConversionFactor,
    CostMethod CostMethod,
    decimal InitialCost = 0m,
    decimal InitialQuantity = 0m,
    decimal? MinLevel = null,
    decimal? MaxLevel = null,
    decimal? ReorderLevel = null) : ICommand<StockMaterialResponse>;
