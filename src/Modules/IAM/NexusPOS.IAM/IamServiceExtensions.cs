using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexusPOS.IAM.Application.Services;
using NexusPOS.IAM.Domain.Repositories;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.IAM.Infrastructure.Persistence.Repositories;
using NexusPOS.IAM.Infrastructure.Services;
using NexusPOS.IAM.Infrastructure.Settings;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.IAM;

public static class IamServiceExtensions
{
    public static IServiceCollection AddIamModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));

        services.AddDbContext<IamDbContext>((sp, options) =>
        {
            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL"));
            options.AddInterceptors(sp.GetRequiredService<TenantSchemaInterceptor>());
        });

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IPasswordService, PasswordService>();
        services.AddScoped<IJwtService, JwtService>();
        services.AddScoped<IUserProvisioningService, UserProvisioningService>();

        return services;
    }
}
