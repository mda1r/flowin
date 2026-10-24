using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Inventory.Domain.Entities;

namespace NexusPOS.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class RecipeLineConfiguration : IEntityTypeConfiguration<RecipeLine>
{
    public void Configure(EntityTypeBuilder<RecipeLine> builder)
    {
        builder.ToTable("recipe_lines");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id).HasColumnName("id");
        builder.Property(r => r.TenantId).HasColumnName("tenant_id");
        builder.Property(r => r.VariantId).HasColumnName("variant_id");
        builder.Property(r => r.MaterialId).HasColumnName("material_id");
        builder.Property(r => r.Quantity).HasColumnName("quantity").HasPrecision(18, 4);
        builder.Property(r => r.CreatedAt).HasColumnName("created_at");

        builder.HasIndex(r => new { r.TenantId, r.VariantId, r.MaterialId })
            .IsUnique()
            .HasDatabaseName("ix_recipe_lines_variant_material");

        builder.HasOne<StockMaterial>()
            .WithMany()
            .HasForeignKey(r => r.MaterialId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
