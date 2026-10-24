using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.DeleteStockMaterial;

public sealed record DeleteStockMaterialCommand(
    Guid TenantId,
    Guid MaterialId) : ICommand;
