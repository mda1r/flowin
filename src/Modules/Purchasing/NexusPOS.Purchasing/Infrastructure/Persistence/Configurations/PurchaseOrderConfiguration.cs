using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.ValueObjects;

namespace NexusPOS.Purchasing.Infrastructure.Persistence.Configurations;

internal sealed class PurchaseOrderConfiguration : IEntityTypeConfiguration<PurchaseOrder>
{
    public void Configure(EntityTypeBuilder<PurchaseOrder> builder)
    {
        builder.ToTable("purchase_orders");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.Id)
            .HasConversion(id => id.Value, value => new PurchaseOrderId(value))
            .HasColumnName("id");

        builder.Property(o => o.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(o => o.BranchId).HasColumnName("branch_id").IsRequired();

        builder.Property(o => o.SupplierId)
            .HasConversion(id => id.Value, value => new SupplierId(value))
            .HasColumnName("supplier_id")
            .IsRequired();

        builder.Property(o => o.Status)
            .HasConversion<string>()
            .HasColumnName("status")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(o => o.ExpectedDeliveryDate).HasColumnName("expected_delivery_date");
        builder.Property(o => o.Notes).HasColumnName("notes").HasMaxLength(1024);
        builder.Property(o => o.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(o => o.UpdatedAt).HasColumnName("updated_at").IsRequired();
        builder.Property(o => o.ReceivedAt).HasColumnName("received_at");

        builder.HasMany(o => o.Lines)
            .WithOne()
            .HasForeignKey("purchase_order_id")
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(o => o.BranchId).HasDatabaseName("ix_purchase_orders_branch_id");
        builder.HasIndex(o => new { o.BranchId, o.Status }).HasDatabaseName("ix_purchase_orders_branch_status");
        builder.HasIndex(o => new { o.BranchId, o.SupplierId }).HasDatabaseName("ix_purchase_orders_branch_supplier");

        builder.Ignore(o => o.TotalAmount);
        builder.Ignore(o => o.DomainEvents);
    }
}
