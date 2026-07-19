using Microsoft.EntityFrameworkCore;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Hotel.Infrastructure.Persistence;

public sealed class HotelDbContext(DbContextOptions<HotelDbContext> options)
    : BaseModuleDbContext(options)
{
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Reservation> Reservations => Set<Reservation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(HotelDbContext).Assembly);
    }
}
