using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Tax.Domain.Entities;

namespace NexusPOS.Tax.Infrastructure.Persistence.Configurations;

internal sealed class TaxPeriodConfiguration : IEntityTypeConfiguration<TaxPeriod>
{
    public void Configure(EntityTypeBuilder<TaxPeriod> builder)
    {
        builder.ToTable("tax_periods");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id).HasColumnName("id");
        builder.Property(p => p.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(p => p.StartDate).HasColumnName("start_date").IsRequired();
        builder.Property(p => p.EndDate).HasColumnName("end_date").IsRequired();
        builder.Property(p => p.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
        builder.Property(p => p.Notes).HasColumnName("notes").HasMaxLength(500);
        builder.Property(p => p.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(p => p.ClosedAt).HasColumnName("closed_at");

        builder.HasIndex(p => p.TenantId).HasDatabaseName("ix_tax_periods_tenant_id");
        builder.HasIndex(p => new { p.TenantId, p.StartDate }).HasDatabaseName("ix_tax_periods_tenant_start");
    }
}
