using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.ValueObjects;

namespace NexusPOS.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class StockItemConfiguration : IEntityTypeConfiguration<StockItem>
{
    public void Configure(EntityTypeBuilder<StockItem> builder)
    {
        builder.ToTable("stock_items");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, value => new StockItemId(value));

        builder.Property(s => s.VariantId)
            .HasColumnName("variant_id");

        builder.Property(s => s.BranchId)
            .HasColumnName("branch_id");

        builder.HasIndex(s => new { s.VariantId, s.BranchId })
            .IsUnique()
            .HasDatabaseName("ix_stock_items_variant_branch");

        builder.Property(s => s.Quantity)
            .HasColumnName("quantity")
            .HasPrecision(18, 4)
            .HasDefaultValue(0m);

        builder.Property(s => s.ReorderPoint)
            .HasColumnName("reorder_point")
            .HasPrecision(18, 4)
            .HasDefaultValue(0m);

        builder.Property(s => s.ReorderQuantity)
            .HasColumnName("reorder_quantity")
            .HasPrecision(18, 4)
            .HasDefaultValue(0m);

        builder.Property(s => s.ExpiryDate)
            .HasColumnName("expiry_date");

        builder.Property(s => s.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(s => s.UpdatedAt)
            .HasColumnName("updated_at");

        builder.HasMany(s => s.Movements)
            .WithOne()
            .HasForeignKey(m => m.StockItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(s => s.DomainEvents);
    }
}
