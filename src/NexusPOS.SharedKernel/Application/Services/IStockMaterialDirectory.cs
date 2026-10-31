namespace NexusPOS.SharedKernel.Application.Services;

// Lets other modules ask about raw stock materials without referencing the Inventory module.
public interface IStockMaterialDirectory
{
    // False for an archived material, so it cannot be added to new orders until it is restored.
    Task<bool> ExistsAsync(Guid tenantId, Guid materialId, CancellationToken cancellationToken = default);
}
