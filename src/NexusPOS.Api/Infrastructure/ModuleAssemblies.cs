using System.Reflection;

namespace NexusPOS.Api.Infrastructure;

internal static class ModuleAssemblies
{
    internal static readonly Assembly[] All =
    [
        typeof(NexusPOS.SharedKernel.SharedKernelModule).Assembly,
        typeof(NexusPOS.IAM.IamModule).Assembly,
        typeof(NexusPOS.Organization.OrganizationModule).Assembly,
        typeof(NexusPOS.Catalog.CatalogModule).Assembly,
        typeof(NexusPOS.Inventory.InventoryModule).Assembly,
        typeof(NexusPOS.POS.PosModule).Assembly,
        typeof(NexusPOS.Sales.SalesModule).Assembly,
        typeof(NexusPOS.Purchasing.PurchasingModule).Assembly,
        typeof(NexusPOS.CRM.CrmModule).Assembly,
        typeof(NexusPOS.Finance.FinanceModule).Assembly,
        typeof(NexusPOS.Restaurant.RestaurantModule).Assembly,
        typeof(NexusPOS.Hotel.HotelModule).Assembly,
        typeof(NexusPOS.Gaming.GamingModule).Assembly,
        typeof(NexusPOS.SuperAdmin.SuperAdminModule).Assembly,
        typeof(NexusPOS.Tax.TaxModule).Assembly,
        typeof(NexusPOS.Zatca.ZatcaModule).Assembly,
    ];
}
