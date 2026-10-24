using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.UpdateStockMaterialCategory;

public sealed record UpdateStockMaterialCategoryCommand(
    Guid TenantId,
    Guid CategoryId,
    string Name) : ICommand<StockMaterialCategoryResponse>;
