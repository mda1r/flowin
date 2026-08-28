using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax;

public static class TaxServiceExtensions
{
    public static IServiceCollection AddTaxModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<TaxConfigDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL")));

        return services;
    }
}
