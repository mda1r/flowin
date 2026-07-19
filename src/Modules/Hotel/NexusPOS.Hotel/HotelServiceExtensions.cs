using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.Hotel.Infrastructure.Persistence.Repositories;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Hotel;

public static class HotelServiceExtensions
{
    public static IServiceCollection AddHotelModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<HotelDbContext>((sp, options) =>
        {
            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL"));
            options.AddInterceptors(sp.GetRequiredService<TenantSchemaInterceptor>());
        });

        services.AddScoped<IRoomRepository, RoomRepository>();
        services.AddScoped<IReservationRepository, ReservationRepository>();

        return services;
    }
}
