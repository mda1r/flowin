using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.CRM.Domain.Entities;

namespace NexusPOS.CRM.Infrastructure.Persistence.Configurations;

internal sealed class LoyaltyLedgerStartConfiguration : IEntityTypeConfiguration<LoyaltyLedgerStart>
{
    public void Configure(EntityTypeBuilder<LoyaltyLedgerStart> builder)
    {
        builder.ToTable("loyalty_ledger_start");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(s => s.StartedAt).HasColumnName("started_at").IsRequired();
    }
}
