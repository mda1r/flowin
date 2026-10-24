using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.DeleteStockMaterialCategory;

public sealed record DeleteStockMaterialCategoryCommand(
    Guid TenantId,
    Guid CategoryId) : ICommand;
