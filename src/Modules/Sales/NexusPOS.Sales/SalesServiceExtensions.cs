using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexusPOS.Sales.Application.Services;
using NexusPOS.Sales.Domain.Repositories;
using NexusPOS.Sales.Infrastructure.Persistence;
using NexusPOS.Sales.Infrastructure.Persistence.Repositories;
using NexusPOS.Sales.Infrastructure.Services;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Sales;

public static class SalesServiceExtensions
{
    public static IServiceCollection AddSalesModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<SalesDbContext>((sp, options) =>
        {
            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL"));
            options.AddInterceptors(sp.GetRequiredService<TenantSchemaInterceptor>());
        });

        services.AddHttpClient();
        services.AddScoped<ISaleRecordRepository, SaleRecordRepository>();
        services.AddScoped<ISalesSummaryRepository, SalesSummaryRepository>();
        services.AddScoped<IClaudeApiService, ClaudeApiService>();

        return services;
    }
}
