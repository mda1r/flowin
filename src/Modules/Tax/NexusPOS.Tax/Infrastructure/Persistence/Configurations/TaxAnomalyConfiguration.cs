using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Tax.Domain.Entities;

namespace NexusPOS.Tax.Infrastructure.Persistence.Configurations;

internal sealed class TaxAnomalyConfiguration : IEntityTypeConfiguration<TaxAnomaly>
{
    public void Configure(EntityTypeBuilder<TaxAnomaly> builder)
    {
        builder.ToTable("tax_anomalies");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id).HasColumnName("id");
        builder.Property(a => a.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(a => a.PeriodId).HasColumnName("period_id");
        builder.Property(a => a.RuleCode).HasColumnName("rule_code").HasMaxLength(50).IsRequired();
        builder.Property(a => a.Severity).HasColumnName("severity").HasMaxLength(10).IsRequired();
        builder.Property(a => a.Title).HasColumnName("title").HasMaxLength(200).IsRequired();
        builder.Property(a => a.Description).HasColumnName("description").HasMaxLength(1000).IsRequired();
        builder.Property(a => a.TransactionRef).HasColumnName("transaction_ref").HasMaxLength(100);
        builder.Property(a => a.DetectedAt).HasColumnName("detected_at").IsRequired();
        builder.Property(a => a.IsResolved).HasColumnName("is_resolved").IsRequired();
        builder.Property(a => a.ResolvedAt).HasColumnName("resolved_at");

        builder.HasIndex(a => new { a.TenantId, a.PeriodId }).HasDatabaseName("ix_tax_anomalies_tenant_period");
        builder.HasIndex(a => new { a.TenantId, a.IsResolved }).HasDatabaseName("ix_tax_anomalies_tenant_resolved");
    }
}
