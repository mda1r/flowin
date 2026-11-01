using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexusPOS.Restaurant.Application.Services;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.Restaurant.Infrastructure.Persistence.Repositories;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Restaurant;

public static class RestaurantServiceExtensions
{
    public static IServiceCollection AddRestaurantModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<RestaurantDbContext>((sp, options) =>
        {
            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL"));
            options.AddInterceptors(sp.GetRequiredService<TenantSchemaInterceptor>());
        });

        services.AddScoped<IMenuItemRepository, MenuItemRepository>();
        services.AddScoped<IRestaurantOrderRepository, RestaurantOrderRepository>();
        services.AddScoped<IDiscountCodeRepository, DiscountCodeRepository>();
        services.AddScoped<IDiscountCodeDirectory, DiscountCodeDirectory>();

        return services;
    }
}
