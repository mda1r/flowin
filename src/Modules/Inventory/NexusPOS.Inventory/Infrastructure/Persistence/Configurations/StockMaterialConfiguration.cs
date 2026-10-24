using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Inventory.Domain.Entities;

namespace NexusPOS.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class StockMaterialConfiguration : IEntityTypeConfiguration<StockMaterial>
{
    public void Configure(EntityTypeBuilder<StockMaterial> builder)
    {
        builder.ToTable("stock_materials");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id).HasColumnName("id");
        builder.Property(m => m.TenantId).HasColumnName("tenant_id");
        builder.Property(m => m.Code).HasColumnName("code").HasMaxLength(50);
        builder.Property(m => m.NameAr).HasColumnName("name_ar").HasMaxLength(200);
        builder.Property(m => m.NameEn).HasColumnName("name_en").HasMaxLength(200);
        builder.Property(m => m.CategoryId).HasColumnName("category_id");
        builder.Property(m => m.StorageUnit).HasColumnName("storage_unit").HasMaxLength(50);
        builder.Property(m => m.ComponentUnit).HasColumnName("component_unit").HasMaxLength(50);
        builder.Property(m => m.ConversionFactor).HasColumnName("conversion_factor").HasPrecision(18, 6);
        builder.Property(m => m.CostMethod).HasColumnName("cost_method").HasConversion<int>();
        builder.Property(m => m.CurrentCost).HasColumnName("current_cost").HasPrecision(18, 4).HasDefaultValue(0m);
        builder.Property(m => m.CurrentQuantityInStorageUnits).HasColumnName("current_quantity").HasPrecision(18, 4).HasDefaultValue(0m);
        builder.Property(m => m.MinLevel).HasColumnName("min_level").HasPrecision(18, 4);
        builder.Property(m => m.MaxLevel).HasColumnName("max_level").HasPrecision(18, 4);
        builder.Property(m => m.ReorderLevel).HasColumnName("reorder_level").HasPrecision(18, 4);
        builder.Property(m => m.IsActive).HasColumnName("is_active").HasDefaultValue(true);
        builder.Property(m => m.CreatedAt).HasColumnName("created_at");
        builder.Property(m => m.UpdatedAt).HasColumnName("updated_at");

        builder.Ignore(m => m.IsLowStock);
        builder.Ignore(m => m.CostPerComponentUnit);

        builder.HasIndex(m => new { m.TenantId, m.Code })
            .IsUnique()
            .HasDatabaseName("ix_stock_materials_tenant_code");

        builder.HasOne<StockMaterialCategory>()
            .WithMany()
            .HasForeignKey(m => m.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
