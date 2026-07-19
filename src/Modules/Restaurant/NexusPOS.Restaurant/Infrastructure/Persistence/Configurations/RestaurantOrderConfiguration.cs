using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.ValueObjects;

namespace NexusPOS.Restaurant.Infrastructure.Persistence.Configurations;

internal sealed class RestaurantOrderConfiguration : IEntityTypeConfiguration<RestaurantOrder>
{
    public void Configure(EntityTypeBuilder<RestaurantOrder> builder)
    {
        builder.ToTable("restaurant_orders");

        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, v => new RestaurantOrderId(v));

        builder.Property(o => o.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(o => o.BranchId).HasColumnName("branch_id").IsRequired();
        builder.Property(o => o.TableNumber).HasColumnName("table_number").IsRequired();

        builder.Property(o => o.Status)
            .HasConversion<string>()
            .HasColumnName("status")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(o => o.Notes).HasColumnName("notes").HasMaxLength(512);
        builder.Property(o => o.AppliedDiscountCode).HasColumnName("applied_discount_code").HasMaxLength(64);
        builder.Property(o => o.DiscountAmount).HasColumnName("discount_amount").HasPrecision(18, 4).IsRequired();
        builder.Property(o => o.SubTotal).HasColumnName("sub_total").HasPrecision(18, 4).IsRequired();
        builder.Property(o => o.TaxAmount).HasColumnName("tax_amount").HasPrecision(18, 4).IsRequired();
        builder.Property(o => o.Total).HasColumnName("total").HasPrecision(18, 4).IsRequired();
        builder.Property(o => o.PaymentMethod).HasColumnName("payment_method").HasMaxLength(32);
        builder.Property(o => o.AmountTendered).HasColumnName("amount_tendered").HasPrecision(18, 4);
        builder.Property(o => o.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(o => o.UpdatedAt).HasColumnName("updated_at").IsRequired();
        builder.Property(o => o.ServedAt).HasColumnName("served_at");
        builder.Property(o => o.PaidAt).HasColumnName("paid_at");

        builder.HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey("restaurant_order_id")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(o => o.DomainEvents);

        builder.HasIndex(o => o.BranchId).HasDatabaseName("ix_restaurant_orders_branch_id");
        builder.HasIndex(o => new { o.BranchId, o.Status }).HasDatabaseName("ix_restaurant_orders_branch_status");
        builder.HasIndex(o => new { o.BranchId, o.TableNumber }).HasDatabaseName("ix_restaurant_orders_branch_table");
        builder.HasIndex(o => o.CreatedAt).HasDatabaseName("ix_restaurant_orders_created_at");
    }
}
