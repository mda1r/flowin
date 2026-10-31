using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexusPOS.Catalog.Domain.Repositories;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.Catalog.Infrastructure.Persistence.Repositories;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Catalog;

public static class CatalogServiceExtensions
{
    public static IServiceCollection AddCatalogModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<CatalogDbContext>((sp, options) =>
        {
            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL"));
            options.AddInterceptors(sp.GetRequiredService<TenantSchemaInterceptor>());
        });

        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();

        return services;
    }
}
