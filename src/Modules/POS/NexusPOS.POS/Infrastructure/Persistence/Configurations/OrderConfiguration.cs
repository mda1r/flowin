using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Infrastructure.Persistence.Configurations;

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("orders");

        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, v => new OrderId(v));

        builder.Property(o => o.TenantId).HasColumnName("tenant_id");
        builder.Property(o => o.BranchId).HasColumnName("branch_id");
        builder.Property(o => o.CustomerId).HasColumnName("customer_id");
        builder.Property(o => o.Currency).HasColumnName("currency").HasMaxLength(3);
        builder.Property(o => o.Status).HasColumnName("status");
        builder.Property(o => o.TaxRate).HasColumnName("tax_rate").HasPrecision(5, 2);
        builder.Property(o => o.SubtotalAmount).HasColumnName("subtotal_amount").HasPrecision(18, 4);
        builder.Property(o => o.DiscountAmount).HasColumnName("discount_amount").HasPrecision(18, 4);
        builder.Property(o => o.TaxAmount).HasColumnName("tax_amount").HasPrecision(18, 4);
        builder.Property(o => o.TotalAmount).HasColumnName("total_amount").HasPrecision(18, 4);
        builder.Property(o => o.PaymentMethod).HasColumnName("payment_method");
        builder.Property(o => o.AmountTendered).HasColumnName("amount_tendered").HasPrecision(18, 4);
        builder.Property(o => o.ChangeDue).HasColumnName("change_due").HasPrecision(18, 4);
        builder.Property(o => o.Notes).HasColumnName("notes").HasMaxLength(512);
        builder.Property(o => o.CreatedAt).HasColumnName("created_at");
        builder.Property(o => o.UpdatedAt).HasColumnName("updated_at");
        builder.Property(o => o.CompletedAt).HasColumnName("completed_at");

        builder.OwnsOne(o => o.OrderDiscount, d =>
        {
            d.Property(p => p.Type).HasColumnName("order_discount_type");
            d.Property(p => p.Value).HasColumnName("order_discount_value").HasPrecision(18, 4);
        });

        builder.HasMany(o => o.Lines)
            .WithOne()
            .HasForeignKey("order_id")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(o => o.DomainEvents);

        builder.HasIndex(o => o.BranchId).HasDatabaseName("ix_orders_branch_id");
        builder.HasIndex(o => new { o.BranchId, o.Status }).HasDatabaseName("ix_orders_branch_status");
        builder.HasIndex(o => o.CreatedAt).HasDatabaseName("ix_orders_created_at");
    }
}
