using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.Finance.Infrastructure.Persistence;
using NexusPOS.Gaming.Infrastructure.Persistence;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.Purchasing.Infrastructure.Persistence;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.Sales.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Infrastructure.Persistence;
using NexusPOS.Zatca.Infrastructure.Persistence;

namespace NexusPOS.Api.Infrastructure;

internal sealed class TenantSchemaProvisioner(
    IServiceScopeFactory scopeFactory,
    ILogger<TenantSchemaProvisioner> logger) : ITenantSchemaProvisioner
{
    public async Task ProvisionAsync(Guid tenantId, CancellationToken ct = default)
    {
        using IServiceScope scope = scopeFactory.CreateScope();
        IServiceProvider sp = scope.ServiceProvider;

        MutableTenantContext tenantCtx = sp.GetRequiredService<MutableTenantContext>();
        tenantCtx.TenantId = tenantId;
        tenantCtx.SchemaName = $"tenant_{tenantId:N}";
        tenantCtx.IsAuthenticated = true;

        CatalogDbContext catalogDb = sp.GetRequiredService<CatalogDbContext>();
        string createSchemaSql = "CREATE SCHEMA IF NOT EXISTS \"" + tenantCtx.SchemaName + "\"";
        await catalogDb.Database.ExecuteSqlRawAsync(createSchemaSql, ct);

        await DatabaseInitializerExtensions.EnsureCreatedAsync<CatalogDbContext>(sp, logger);
        await DatabaseInitializerExtensions.EnsureCreatedAsync<InventoryDbContext>(sp, logger);
        await DatabaseInitializerExtensions.EnsureCreatedAsync<PosDbContext>(sp, logger);
        await DatabaseInitializerExtensions.MigratePosColumnsAsync(sp, logger);
        await DatabaseInitializerExtensions.EnsureCreatedAsync<SalesDbContext>(sp, logger);
        await DatabaseInitializerExtensions.EnsureCreatedAsync<CrmDbContext>(sp, logger);
        await DatabaseInitializerExtensions.EnsureCreatedAsync<PurchasingDbContext>(sp, logger);
        await DatabaseInitializerExtensions.EnsureCreatedAsync<FinanceDbContext>(sp, logger);
        await DatabaseInitializerExtensions.EnsureCreatedAsync<ZatcaDbContext>(sp, logger);
        await DatabaseInitializerExtensions.EnsureCreatedAsync<RestaurantDbContext>(sp, logger);
        await DatabaseInitializerExtensions.EnsureCreatedAsync<HotelDbContext>(sp, logger);
        await DatabaseInitializerExtensions.EnsureCreatedAsync<GamingDbContext>(sp, logger);

        logger.LogInformation(
            "Provisioned schema {Schema} for new tenant {TenantId}",
            tenantCtx.SchemaName, tenantId);
    }
}
