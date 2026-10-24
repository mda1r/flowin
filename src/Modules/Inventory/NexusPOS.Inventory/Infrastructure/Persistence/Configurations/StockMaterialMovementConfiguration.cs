using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Inventory.Domain.Entities;

namespace NexusPOS.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class StockMaterialMovementConfiguration : IEntityTypeConfiguration<StockMaterialMovement>
{
    public void Configure(EntityTypeBuilder<StockMaterialMovement> builder)
    {
        builder.ToTable("stock_material_movements");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id).HasColumnName("id");
        builder.Property(m => m.TenantId).HasColumnName("tenant_id");
        builder.Property(m => m.MaterialId).HasColumnName("material_id");
        builder.Property(m => m.Type).HasColumnName("type").HasConversion<int>();
        builder.Property(m => m.QuantityChange).HasColumnName("quantity_change").HasPrecision(18, 4);
        builder.Property(m => m.UnitCost).HasColumnName("unit_cost").HasPrecision(18, 4);
        builder.Property(m => m.QuantityAfter).HasColumnName("quantity_after").HasPrecision(18, 4);
        builder.Property(m => m.CostAfter).HasColumnName("cost_after").HasPrecision(18, 4);
        builder.Property(m => m.Note).HasColumnName("note").HasMaxLength(500);
        builder.Property(m => m.UserId).HasColumnName("user_id");
        builder.Property(m => m.CreatedAt).HasColumnName("created_at");

        builder.HasIndex(m => new { m.TenantId, m.MaterialId, m.CreatedAt })
            .HasDatabaseName("ix_stock_material_movements_material");

        builder.HasOne<StockMaterial>()
            .WithMany()
            .HasForeignKey(m => m.MaterialId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
