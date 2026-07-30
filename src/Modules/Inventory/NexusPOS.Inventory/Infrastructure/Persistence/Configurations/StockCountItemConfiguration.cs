using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.ValueObjects;

namespace NexusPOS.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class StockCountItemConfiguration : IEntityTypeConfiguration<StockCountItem>
{
    public void Configure(EntityTypeBuilder<StockCountItem> builder)
    {
        builder.ToTable("stock_count_items");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, value => new StockCountItemId(value));

        builder.Property(i => i.SessionId)
            .HasColumnName("session_id")
            .HasConversion(id => id.Value, value => new StockCountSessionId(value));

        builder.Property(i => i.StockItemId).HasColumnName("stock_item_id");
        builder.Property(i => i.VariantId).HasColumnName("variant_id");
        builder.Property(i => i.SystemQuantity).HasColumnName("system_quantity").HasPrecision(18, 4);
        builder.Property(i => i.CountedQuantity).HasColumnName("counted_quantity").HasPrecision(18, 4);
        builder.Property(i => i.UnitCost).HasColumnName("unit_cost").HasPrecision(18, 4);

        builder.HasIndex(i => i.SessionId).HasDatabaseName("ix_stock_count_items_session_id");

        builder.Ignore(i => i.Difference);
        builder.Ignore(i => i.SystemValue);
        builder.Ignore(i => i.CountedValue);
        builder.Ignore(i => i.TaxAmount);
        builder.Ignore(i => i.HasDiscrepancy);
    }
}
