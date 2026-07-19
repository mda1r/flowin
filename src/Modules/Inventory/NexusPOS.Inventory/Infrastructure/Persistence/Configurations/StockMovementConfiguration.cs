using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.ValueObjects;

namespace NexusPOS.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class StockMovementConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> builder)
    {
        builder.ToTable("stock_movements");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, value => new StockMovementId(value));

        builder.Property(m => m.StockItemId)
            .HasColumnName("stock_item_id")
            .HasConversion(id => id.Value, value => new StockItemId(value));

        builder.HasIndex(m => m.StockItemId)
            .HasDatabaseName("ix_stock_movements_stock_item_id");

        builder.Property(m => m.Type)
            .HasColumnName("type")
            .HasConversion<int>();

        builder.Property(m => m.Quantity)
            .HasColumnName("quantity")
            .HasPrecision(18, 4);

        builder.Property(m => m.QuantityBefore)
            .HasColumnName("quantity_before")
            .HasPrecision(18, 4);

        builder.Property(m => m.QuantityAfter)
            .HasColumnName("quantity_after")
            .HasPrecision(18, 4);

        builder.Property(m => m.Reference)
            .HasColumnName("reference")
            .HasMaxLength(128);

        builder.Property(m => m.Notes)
            .HasColumnName("notes")
            .HasMaxLength(512);

        builder.Property(m => m.OccurredAt)
            .HasColumnName("occurred_at");
    }
}
