using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexusPOS.CRM.Application.Services;
using NexusPOS.CRM.Domain.Repositories;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.CRM.Infrastructure.Persistence.Repositories;
using NexusPOS.CRM.Infrastructure.WhatsApp;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.CRM;

public static class CrmServiceExtensions
{
    public static IServiceCollection AddCrmModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<CrmDbContext>((sp, options) =>
        {
            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL"));
            options.AddInterceptors(sp.GetRequiredService<TenantSchemaInterceptor>());
        });

        services.AddScoped<ICustomerRepository, CustomerRepository>();
        services.AddScoped<ICustomerLoyaltyDirectory, CustomerLoyaltyDirectory>();
        services.AddHttpClient<IWhatsAppSender, WhatsAppCloudClient>(client =>
        {
            // Overridable so tests can point at a local stand-in instead of Meta.
            client.BaseAddress = new Uri(configuration["WhatsApp:GraphBaseUrl"] ?? "https://graph.facebook.com/");
            client.Timeout = TimeSpan.FromSeconds(30);
        });

        return services;
    }
}
