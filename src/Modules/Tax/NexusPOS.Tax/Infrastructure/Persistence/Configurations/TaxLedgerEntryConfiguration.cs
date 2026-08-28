using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Tax.Domain.Entities;

namespace NexusPOS.Tax.Infrastructure.Persistence.Configurations;

internal sealed class TaxLedgerEntryConfiguration : IEntityTypeConfiguration<TaxLedgerEntry>
{
    public void Configure(EntityTypeBuilder<TaxLedgerEntry> builder)
    {
        builder.ToTable("tax_ledger_entries");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id).HasColumnName("id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(e => e.PeriodId).HasColumnName("period_id");
        builder.Property(e => e.EntryType).HasColumnName("entry_type").HasMaxLength(20).IsRequired();
        builder.Property(e => e.TransactionType).HasColumnName("transaction_type").HasMaxLength(30).IsRequired();
        builder.Property(e => e.ReferenceId).HasColumnName("reference_id");
        builder.Property(e => e.ReferenceType).HasColumnName("reference_type").HasMaxLength(50);
        builder.Property(e => e.BaseAmount).HasColumnName("base_amount").HasColumnType("numeric(18,4)").IsRequired();
        builder.Property(e => e.TaxAmount).HasColumnName("tax_amount").HasColumnType("numeric(18,4)").IsRequired();
        builder.Property(e => e.TaxRate).HasColumnName("tax_rate").HasColumnType("numeric(6,4)").IsRequired();
        builder.Property(e => e.EffectiveDate).HasColumnName("effective_date").IsRequired();
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(e => e.TenantId).HasDatabaseName("ix_tax_ledger_entries_tenant_id");
        builder.HasIndex(e => new { e.TenantId, e.PeriodId }).HasDatabaseName("ix_tax_ledger_entries_tenant_period");
        builder.HasIndex(e => new { e.TenantId, e.EffectiveDate }).HasDatabaseName("ix_tax_ledger_entries_tenant_date");
    }
}
