using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.CRM.Infrastructure.Persistence;

public sealed class CrmDbContext(DbContextOptions<CrmDbContext> options, MediatR.IPublisher publisher)
    : BaseModuleDbContext(options, publisher)
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<LoyaltySettings> LoyaltySettings => Set<LoyaltySettings>();
    public DbSet<MarketingCampaign> MarketingCampaigns => Set<MarketingCampaign>();
    public DbSet<MarketingMedia> MarketingMedia => Set<MarketingMedia>();
    public DbSet<WhatsAppSettings> WhatsAppSettings => Set<WhatsAppSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CrmDbContext).Assembly);
    }
}
