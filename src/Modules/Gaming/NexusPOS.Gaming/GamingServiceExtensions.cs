using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexusPOS.Gaming.Domain.Repositories;
using NexusPOS.Gaming.Infrastructure.Persistence;
using NexusPOS.Gaming.Infrastructure.Persistence.Repositories;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Gaming;

public static class GamingServiceExtensions
{
    public static IServiceCollection AddGamingModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<GamingDbContext>((sp, options) =>
        {
            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL"));
            options.AddInterceptors(sp.GetRequiredService<TenantSchemaInterceptor>());
        });

        services.AddScoped<IGameStationRepository, GameStationRepository>();
        services.AddScoped<IGameSessionRepository, GameSessionRepository>();

        return services;
    }
}
