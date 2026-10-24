using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.Inventory.Application.Services;

internal sealed class StockMaterialDirectory(InventoryDbContext db) : IStockMaterialDirectory
{
    public Task<bool> ExistsAsync(Guid tenantId, Guid materialId, CancellationToken cancellationToken = default)
        => db.StockMaterials.AnyAsync(m => m.Id == materialId && m.TenantId == tenantId, cancellationToken);
}
