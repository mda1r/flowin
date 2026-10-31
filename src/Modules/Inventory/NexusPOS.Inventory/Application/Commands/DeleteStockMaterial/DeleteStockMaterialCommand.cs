using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.DeleteStockMaterial;

public sealed record DeleteStockMaterialCommand(
    Guid TenantId,
    Guid MaterialId) : ICommand<DeleteStockMaterialResponse>;

// Archived is true when the material had movements and was kept for its history.
public sealed record DeleteStockMaterialResponse(bool Archived);
