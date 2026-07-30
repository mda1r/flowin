using NexusPOS.Catalog;
using NexusPOS.CRM;
using NexusPOS.Finance;
using NexusPOS.Gaming;
using NexusPOS.Hotel;
using NexusPOS.IAM;
using NexusPOS.Inventory;
using NexusPOS.Organization;
using NexusPOS.POS;
using NexusPOS.Purchasing;
using NexusPOS.Restaurant;
using NexusPOS.Sales;
using NexusPOS.SuperAdmin;
using NexusPOS.Zatca;

namespace NexusPOS.Api.Infrastructure;

internal static class ModulesServiceExtensions
{
    internal static IServiceCollection AddModules(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddIamModule(configuration);
        services.AddOrganizationModule(configuration);
        services.AddCatalogModule(configuration);
        services.AddInventoryModule(configuration);
        services.AddPosModule(configuration);
        services.AddSalesModule(configuration);
        services.AddPurchasingModule(configuration);
        services.AddCrmModule(configuration);
        services.AddFinanceModule(configuration);
        services.AddRestaurantModule(configuration);
        services.AddHotelModule(configuration);
        services.AddGamingModule(configuration);
        services.AddSuperAdminModule(configuration);
        services.AddZatcaModule(configuration);

        return services;
    }
}
