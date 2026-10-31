using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.Infrastructure.Persistence.Configurations;

internal sealed class ProductModifierGroupConfiguration : IEntityTypeConfiguration<ProductModifierGroup>
{
    public void Configure(EntityTypeBuilder<ProductModifierGroup> builder)
    {
        builder.ToTable("product_modifier_groups");

        builder.HasKey(l => new { l.ProductId, l.GroupId });

        builder.Property(l => l.ProductId)
            .HasColumnName("product_id")
            .HasConversion(id => id.Value, value => new ProductId(value));

        builder.Property(l => l.GroupId)
            .HasColumnName("group_id")
            .HasConversion(id => id.Value, value => new ModifierGroupId(value));

        builder.Property(l => l.SortOrder).HasColumnName("sort_order");

        builder.HasOne<Product>()
            .WithMany()
            .HasForeignKey(l => l.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<ModifierGroup>()
            .WithMany()
            .HasForeignKey(l => l.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(l => l.GroupId)
            .HasDatabaseName("ix_product_modifier_groups_group_id");
    }
}
