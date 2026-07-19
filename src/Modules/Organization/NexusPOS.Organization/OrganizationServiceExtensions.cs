using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexusPOS.Organization.Domain.Repositories;
using NexusPOS.Organization.Infrastructure.Persistence;
using NexusPOS.Organization.Infrastructure.Persistence.Repositories;
using NexusPOS.Organization.Infrastructure.Services;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Organization;

public static class OrganizationServiceExtensions
{
    public static IServiceCollection AddOrganizationModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<OrganizationDbContext>((sp, options) =>
        {
            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL"));
            options.AddInterceptors(sp.GetRequiredService<TenantSchemaInterceptor>());
        });

        services.AddScoped<ITenantRepository, TenantRepository>();
        services.AddScoped<IBranchRepository, BranchRepository>();
        services.AddScoped<ITenantContextResolver, TenantContextResolver>();

        return services;
    }
}
