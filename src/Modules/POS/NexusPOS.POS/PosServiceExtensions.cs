using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexusPOS.POS.Domain.Repositories;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.POS.Infrastructure.Persistence.Repositories;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.POS;

public static class PosServiceExtensions
{
    public static IServiceCollection AddPosModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<PosDbContext>((sp, options) =>
        {
            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL"));
            options.AddInterceptors(sp.GetRequiredService<TenantSchemaInterceptor>());
        });

        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<PosDbContext>());
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IReturnOrderRepository, ReturnOrderRepository>();
        services.AddScoped<IShiftRepository, ShiftRepository>();

        return services;
    }
}
