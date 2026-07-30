using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexusPOS.SharedKernel.Infrastructure.Persistence;
using NexusPOS.Zatca.Domain.Repositories;
using NexusPOS.Zatca.Infrastructure.Persistence;
using NexusPOS.Zatca.Infrastructure.Persistence.Repositories;

namespace NexusPOS.Zatca;

public static class ZatcaServiceExtensions
{
    public static IServiceCollection AddZatcaModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ZatcaDbContext>((sp, options) =>
        {
            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL"));
            options.AddInterceptors(sp.GetRequiredService<TenantSchemaInterceptor>());
        });

        services.AddScoped<IZatcaInvoiceRepository, ZatcaInvoiceRepository>();
        services.AddScoped<IZatcaSettingsRepository, ZatcaSettingsRepository>();

        return services;
    }
}
