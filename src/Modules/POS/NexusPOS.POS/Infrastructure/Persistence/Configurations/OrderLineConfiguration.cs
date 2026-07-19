using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Infrastructure.Persistence.Configurations;

internal sealed class OrderLineConfiguration : IEntityTypeConfiguration<OrderLine>
{
    public void Configure(EntityTypeBuilder<OrderLine> builder)
    {
        builder.ToTable("order_lines");

        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, v => new OrderLineId(v));

        builder.Property(l => l.VariantId).HasColumnName("variant_id");
        builder.Property(l => l.ProductName).HasColumnName("product_name").HasMaxLength(256);
        builder.Property(l => l.VariantName).HasColumnName("variant_name").HasMaxLength(256);
        builder.Property(l => l.Quantity).HasColumnName("quantity").HasPrecision(18, 4);

        builder.OwnsOne(l => l.UnitPrice, m =>
        {
            m.Property(p => p.Amount).HasColumnName("unit_price_amount").HasPrecision(18, 4);
            m.Property(p => p.Currency).HasColumnName("unit_price_currency").HasMaxLength(3);
        });

        builder.OwnsOne(l => l.LineDiscount, d =>
        {
            d.Property(p => p.Type).HasColumnName("line_discount_type");
            d.Property(p => p.Value).HasColumnName("line_discount_value").HasPrecision(18, 4);
        });

        builder.Ignore(l => l.LineSubtotal);
        builder.Ignore(l => l.LineDiscountAmount);
        builder.Ignore(l => l.LineTotal);
    }
}
