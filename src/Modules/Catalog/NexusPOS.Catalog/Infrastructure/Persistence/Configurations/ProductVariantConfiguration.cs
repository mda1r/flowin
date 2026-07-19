using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.Infrastructure.Persistence.Configurations;

internal sealed class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> builder)
    {
        builder.ToTable("product_variants");

        builder.HasKey(v => v.Id);

        builder.Property(v => v.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, value => new VariantId(value));

        builder.Property(v => v.ProductId)
            .HasColumnName("product_id")
            .HasConversion(id => id.Value, value => new ProductId(value));

        builder.OwnsOne(v => v.Sku, nav =>
        {
            nav.Property(s => s.Value)
                .HasColumnName("sku")
                .HasMaxLength(64)
                .IsRequired();

            nav.HasIndex(s => s.Value)
                .IsUnique()
                .HasDatabaseName("ix_product_variants_sku");
        });

        builder.Property(v => v.Name)
            .HasColumnName("name")
            .HasMaxLength(256)
            .IsRequired();

        builder.OwnsOne(v => v.CostPrice, nav =>
        {
            nav.Property(m => m.Amount).HasColumnName("cost_price").HasPrecision(18, 4);
            nav.Property(m => m.Currency).HasColumnName("cost_price_currency").HasMaxLength(3);
        });

        builder.OwnsOne(v => v.SalePrice, nav =>
        {
            nav.Property(m => m.Amount).HasColumnName("sale_price").HasPrecision(18, 4);
            nav.Property(m => m.Currency).HasColumnName("sale_price_currency").HasMaxLength(3);
        });

        builder.Property(v => v.Barcode)
            .HasColumnName("barcode")
            .HasMaxLength(64);

        builder.Property(v => v.ExpiryDate)
            .HasColumnName("expiry_date");

        builder.Property(v => v.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(v => v.CreatedAt)
            .HasColumnName("created_at");
    }
}
