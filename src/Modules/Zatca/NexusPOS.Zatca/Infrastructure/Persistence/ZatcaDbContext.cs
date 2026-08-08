using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Infrastructure.Persistence;
using NexusPOS.Zatca.Domain.Entities;

namespace NexusPOS.Zatca.Infrastructure.Persistence;

public sealed class ZatcaDbContext(DbContextOptions<ZatcaDbContext> options, MediatR.IPublisher publisher)
    : BaseModuleDbContext(options, publisher)
{
    public DbSet<ZatcaInvoice> ZatcaInvoices => Set<ZatcaInvoice>();
    public DbSet<ZatcaSettings> ZatcaSettings => Set<ZatcaSettings>();
}
