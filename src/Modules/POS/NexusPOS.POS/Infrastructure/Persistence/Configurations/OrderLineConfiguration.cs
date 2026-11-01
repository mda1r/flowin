using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Unicode;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Infrastructure.Persistence.Configurations;

internal sealed class OrderLineConfiguration : IEntityTypeConfiguration<OrderLine>
{
    // {"id","name","priceDelta"} with Arabic kept readable in the column.
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.Create(UnicodeRanges.All),
    };

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
        builder.Property(l => l.Notes).HasColumnName("notes").HasMaxLength(256);

        // A JSON array in a TEXT column (patched onto existing schemas at startup); older lines read null.
        builder.Property(l => l.Modifiers)
            .HasColumnName("modifiers")
            .HasConversion(
                m => m == null ? null : JsonSerializer.Serialize(m, _json),
                s => s == null ? null : JsonSerializer.Deserialize<List<OrderLineModifier>>(s, _json),
                new ValueComparer<IReadOnlyList<OrderLineModifier>?>(
                    (a, b) => a == null ? b == null : b != null && a.SequenceEqual(b),
                    m => m == null ? 0 : m.Aggregate(0, (h, x) => HashCode.Combine(h, x.GetHashCode())),
                    m => m == null ? null : m.ToList()));

        builder.OwnsOne(l => l.UnitPrice, m =>
        {
            m.Property(p => p.Amount).HasColumnName("unit_price_amount").HasPrecision(18, 4);
            m.Property(p => p.Currency).HasColumnName("unit_price_currency").HasMaxLength(3);
        });

        builder.Property(l => l.CostPrice)
            .HasColumnName("cost_price")
            .HasPrecision(18, 4)
            .HasDefaultValue(0m);

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
