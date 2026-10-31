using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Infrastructure.Persistence.Configurations;

internal sealed class ReturnOrderConfiguration : IEntityTypeConfiguration<ReturnOrder>
{
    public void Configure(EntityTypeBuilder<ReturnOrder> builder)
    {
        builder.ToTable("return_orders");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, v => new ReturnOrderId(v));

        builder.Property(r => r.OriginalOrderId).HasColumnName("original_order_id");
        builder.Property(r => r.TenantId).HasColumnName("tenant_id");
        builder.Property(r => r.BranchId).HasColumnName("branch_id");
        builder.Property(r => r.Currency).HasColumnName("currency").HasMaxLength(3);
        builder.Property(r => r.RefundAmount).HasColumnName("refund_amount").HasPrecision(18, 4);
        builder.Property(r => r.RefundMethod).HasColumnName("refund_method");
        builder.Property(r => r.CreatedAt).HasColumnName("created_at");

        builder.HasMany(r => r.Lines)
            .WithOne()
            .HasForeignKey("return_order_id")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(r => r.DomainEvents);

        builder.HasIndex(r => r.OriginalOrderId).HasDatabaseName("ix_return_orders_original_order_id");
        builder.HasIndex(r => r.BranchId).HasDatabaseName("ix_return_orders_branch_id");
    }
}

internal sealed class ReturnOrderLineConfiguration : IEntityTypeConfiguration<ReturnOrderLine>
{
    public void Configure(EntityTypeBuilder<ReturnOrderLine> builder)
    {
        builder.ToTable("return_order_lines");

        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, v => new ReturnOrderLineId(v));

        builder.Property(l => l.OriginalLineId).HasColumnName("original_line_id");
        builder.Property(l => l.VariantId).HasColumnName("variant_id");
        builder.Property(l => l.ProductName).HasColumnName("product_name").HasMaxLength(256);
        builder.Property(l => l.VariantName).HasColumnName("variant_name").HasMaxLength(256);
        builder.Property(l => l.Quantity).HasColumnName("quantity").HasPrecision(18, 4);
        builder.Property(l => l.UnitPrice).HasColumnName("unit_price").HasPrecision(18, 4);
        builder.Property(l => l.LineTotal).HasColumnName("line_total").HasPrecision(18, 4);
        builder.Property(l => l.Reason).HasColumnName("reason");
    }
}
