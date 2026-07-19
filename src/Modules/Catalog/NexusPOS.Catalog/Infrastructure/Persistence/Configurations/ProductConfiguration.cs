using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.Enums;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.Infrastructure.Persistence.Configurations;

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("products");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, value => new ProductId(value));

        builder.Property(p => p.Name)
            .HasColumnName("name")
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(p => p.Description)
            .HasColumnName("description")
            .HasMaxLength(2048);

        builder.Property(p => p.CategoryId)
            .HasColumnName("category_id")
            .HasConversion(
                id => id == null ? (Guid?)null : id.Value,
                value => value == null ? null : new CategoryId(value.Value));

        builder.HasIndex(p => p.CategoryId)
            .HasDatabaseName("ix_products_category_id");

        builder.Property(p => p.Type)
            .HasColumnName("type")
            .HasConversion<int>()
            .HasDefaultValue(ProductType.Standard);

        builder.Property(p => p.TaxClass)
            .HasColumnName("tax_class")
            .HasConversion<int>()
            .HasDefaultValue(TaxClass.Standard);

        builder.Property(p => p.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(p => p.TrackInventory)
            .HasColumnName("track_inventory")
            .HasDefaultValue(true);

        builder.Property(p => p.ImageUrl)
            .HasColumnName("image_url")
            .HasMaxLength(2048);

        builder.Property(p => p.CreatedAt)
            .HasColumnName("created_at");

        builder.HasMany(p => p.Variants)
            .WithOne()
            .HasForeignKey(v => v.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(p => p.DomainEvents);
    }
}
