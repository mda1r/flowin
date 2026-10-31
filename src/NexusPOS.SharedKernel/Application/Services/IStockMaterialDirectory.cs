namespace NexusPOS.SharedKernel.Application.Services;

// Lets other modules ask about raw stock materials without referencing the Inventory module.
public interface IStockMaterialDirectory
{
    Task<bool> ExistsAsync(Guid tenantId, Guid materialId, CancellationToken cancellationToken = default);
}
