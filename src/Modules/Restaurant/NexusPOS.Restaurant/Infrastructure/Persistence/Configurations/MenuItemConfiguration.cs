using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.ValueObjects;

namespace NexusPOS.Restaurant.Infrastructure.Persistence.Configurations;

internal sealed class MenuItemConfiguration : IEntityTypeConfiguration<MenuItem>
{
    public void Configure(EntityTypeBuilder<MenuItem> builder)
    {
        builder.ToTable("menu_items");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasConversion(id => id.Value, value => new MenuItemId(value))
            .HasColumnName("id");

        builder.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(e => e.BranchId).HasColumnName("branch_id").IsRequired();

        builder.Property(e => e.Category)
            .HasConversion<string>()
            .HasColumnName("category")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(e => e.Name).HasColumnName("name").HasMaxLength(128).IsRequired();
        builder.Property(e => e.Description).HasColumnName("description").HasMaxLength(1024).IsRequired();
        builder.Property(e => e.Price).HasColumnName("price").HasPrecision(18, 4).IsRequired();
        builder.Property(e => e.Currency).HasColumnName("currency").HasMaxLength(3).IsRequired();
        builder.Property(e => e.IsAvailable).HasColumnName("is_available").IsRequired();
        builder.Property(e => e.SortOrder).HasColumnName("sort_order").IsRequired();
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasIndex(e => e.BranchId).HasDatabaseName("ix_menu_items_branch_id");
        builder.HasIndex(e => new { e.BranchId, e.Category }).HasDatabaseName("ix_menu_items_branch_category");
        builder.HasIndex(e => new { e.BranchId, e.SortOrder }).HasDatabaseName("ix_menu_items_branch_sort");
        builder.HasIndex(e => new { e.BranchId, e.IsAvailable }).HasDatabaseName("ix_menu_items_branch_available");

        builder.Ignore(e => e.DomainEvents);
    }
}
