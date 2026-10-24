using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Inventory.Domain.Entities;

namespace NexusPOS.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class StockMaterialCategoryConfiguration : IEntityTypeConfiguration<StockMaterialCategory>
{
    public void Configure(EntityTypeBuilder<StockMaterialCategory> builder)
    {
        builder.ToTable("stock_material_categories");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id).HasColumnName("id");
        builder.Property(c => c.TenantId).HasColumnName("tenant_id");
        builder.Property(c => c.Name).HasColumnName("name").HasMaxLength(100);
        builder.Property(c => c.IsActive).HasColumnName("is_active").HasDefaultValue(true);
        builder.Property(c => c.CreatedAt).HasColumnName("created_at");
        builder.Property(c => c.UpdatedAt).HasColumnName("updated_at");

        builder.HasIndex(c => new { c.TenantId, c.Name })
            .IsUnique()
            .HasDatabaseName("ix_stock_material_categories_tenant_name");
    }
}
