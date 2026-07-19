using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.ValueObjects;

namespace NexusPOS.Restaurant.Infrastructure.Persistence.Configurations;

internal sealed class DiscountCodeConfiguration : IEntityTypeConfiguration<DiscountCode>
{
    public void Configure(EntityTypeBuilder<DiscountCode> builder)
    {
        builder.ToTable("discount_codes");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, v => new DiscountCodeId(v));

        builder.Property(c => c.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(c => c.Code).HasColumnName("code").HasMaxLength(64).IsRequired();

        builder.Property(c => c.Type)
            .HasConversion<string>()
            .HasColumnName("type")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(c => c.Value).HasColumnName("value").HasPrecision(18, 4).IsRequired();
        builder.Property(c => c.MinOrderAmount).HasColumnName("min_order_amount").HasPrecision(18, 4).IsRequired();
        builder.Property(c => c.MaxUses).HasColumnName("max_uses").IsRequired();
        builder.Property(c => c.UsedCount).HasColumnName("used_count").IsRequired();
        builder.Property(c => c.ExpiryDate).HasColumnName("expiry_date").IsRequired();
        builder.Property(c => c.IsActive).HasColumnName("is_active").IsRequired();
        builder.Property(c => c.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.Ignore(c => c.DomainEvents);

        builder.HasIndex(c => c.TenantId).HasDatabaseName("ix_discount_codes_tenant_id");
        builder.HasIndex(c => new { c.TenantId, c.Code }).IsUnique().HasDatabaseName("ix_discount_codes_tenant_code");
    }
}
