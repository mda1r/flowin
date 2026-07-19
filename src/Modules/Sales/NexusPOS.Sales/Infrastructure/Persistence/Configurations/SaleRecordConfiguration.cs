using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Sales.Domain.Entities;
using NexusPOS.Sales.Domain.ValueObjects;

namespace NexusPOS.Sales.Infrastructure.Persistence.Configurations;

internal sealed class SaleRecordConfiguration : IEntityTypeConfiguration<SaleRecord>
{
    public void Configure(EntityTypeBuilder<SaleRecord> builder)
    {
        builder.ToTable("sale_records");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, v => new SaleRecordId(v));

        builder.Property(r => r.OrderId).HasColumnName("order_id");
        builder.Property(r => r.TenantId).HasColumnName("tenant_id");
        builder.Property(r => r.BranchId).HasColumnName("branch_id");
        builder.Property(r => r.Currency).HasColumnName("currency").HasMaxLength(3);
        builder.Property(r => r.SubtotalAmount).HasColumnName("subtotal_amount").HasPrecision(18, 4);
        builder.Property(r => r.DiscountAmount).HasColumnName("discount_amount").HasPrecision(18, 4);
        builder.Property(r => r.TaxAmount).HasColumnName("tax_amount").HasPrecision(18, 4);
        builder.Property(r => r.TotalAmount).HasColumnName("total_amount").HasPrecision(18, 4);
        builder.Property(r => r.PaymentMethod).HasColumnName("payment_method");
        builder.Property(r => r.CompletedAt).HasColumnName("completed_at");

        builder.HasIndex(r => r.BranchId).HasDatabaseName("ix_sale_records_branch_id");
        builder.HasIndex(r => r.CompletedAt).HasDatabaseName("ix_sale_records_completed_at");
        builder.HasIndex(r => r.OrderId).IsUnique().HasDatabaseName("ux_sale_records_order_id");
    }
}
