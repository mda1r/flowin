using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SuperAdmin.Domain.Repositories;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;
using NexusPOS.SuperAdmin.Infrastructure.Persistence.Repositories;
using NexusPOS.SuperAdmin.Infrastructure.Services;

namespace NexusPOS.SuperAdmin;

public static class SuperAdminServiceExtensions
{
    public static IServiceCollection AddSuperAdminModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<SuperAdminDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL")));

        services.AddScoped<ISubscriptionPlanRepository, SubscriptionPlanRepository>();
        services.AddScoped<ITenantSubscriptionRepository, TenantSubscriptionRepository>();
        services.AddScoped<ITenantSubscriptionChecker, TenantSubscriptionChecker>();

        return services;
    }
}
