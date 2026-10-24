using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.CreateStockMaterialCategory;

public sealed record CreateStockMaterialCategoryCommand(
    Guid TenantId,
    string Name) : ICommand<StockMaterialCategoryResponse>;
