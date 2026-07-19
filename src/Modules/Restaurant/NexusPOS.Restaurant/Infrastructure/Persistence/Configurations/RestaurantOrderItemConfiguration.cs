using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.ValueObjects;

namespace NexusPOS.Restaurant.Infrastructure.Persistence.Configurations;

internal sealed class RestaurantOrderItemConfiguration : IEntityTypeConfiguration<RestaurantOrderItem>
{
    public void Configure(EntityTypeBuilder<RestaurantOrderItem> builder)
    {
        builder.ToTable("restaurant_order_items");

        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, v => new RestaurantOrderItemId(v));

        builder.Property(i => i.MenuItemId).HasColumnName("menu_item_id").IsRequired();
        builder.Property(i => i.ItemName).HasColumnName("item_name").HasMaxLength(128).IsRequired();
        builder.Property(i => i.Quantity).HasColumnName("quantity").IsRequired();
        builder.Property(i => i.UnitPrice).HasColumnName("unit_price").HasPrecision(18, 4).IsRequired();
        builder.Property(i => i.Notes).HasColumnName("notes").HasMaxLength(256);

        builder.Property(i => i.Status)
            .HasConversion<string>()
            .HasColumnName("status")
            .HasMaxLength(32)
            .IsRequired();

        builder.Ignore(i => i.LineTotal);

        builder.HasIndex("restaurant_order_id").HasDatabaseName("ix_restaurant_order_items_order_id");
    }
}
