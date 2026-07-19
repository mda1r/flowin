using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.ValueObjects;

namespace NexusPOS.Purchasing.Infrastructure.Persistence.Configurations;

internal sealed class PurchaseOrderLineConfiguration : IEntityTypeConfiguration<PurchaseOrderLine>
{
    public void Configure(EntityTypeBuilder<PurchaseOrderLine> builder)
    {
        builder.ToTable("purchase_order_lines");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasConversion(id => id.Value, value => new PurchaseOrderLineId(value))
            .HasColumnName("id");

        builder.Property<PurchaseOrderId>("purchase_order_id")
            .HasConversion(id => id.Value, value => new PurchaseOrderId(value))
            .HasColumnName("purchase_order_id")
            .IsRequired();

        builder.Property(l => l.VariantId).HasColumnName("variant_id").IsRequired();
        builder.Property(l => l.Description).HasColumnName("description").HasMaxLength(512).IsRequired();
        builder.Property(l => l.UnitCost).HasColumnName("unit_cost").HasPrecision(18, 4).IsRequired();
        builder.Property(l => l.OrderedQuantity).HasColumnName("ordered_quantity").HasPrecision(18, 4).IsRequired();
        builder.Property(l => l.ReceivedQuantity).HasColumnName("received_quantity").HasPrecision(18, 4).IsRequired();

        builder.HasIndex("purchase_order_id")
            .HasDatabaseName("ix_purchase_order_lines_order_id");

        builder.Ignore(l => l.LineTotal);
        builder.Ignore(l => l.IsFullyReceived);
    }
}
