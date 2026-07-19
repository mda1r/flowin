using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.Infrastructure.Persistence.Configurations;

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("categories");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, value => new CategoryId(value));

        builder.Property(c => c.Name)
            .HasColumnName("name")
            .HasMaxLength(128)
            .IsRequired();

        builder.HasIndex(c => new { c.Name, c.ParentId })
            .IsUnique()
            .HasDatabaseName("ix_categories_name_parent");

        builder.Property(c => c.Description)
            .HasColumnName("description")
            .HasMaxLength(512);

        builder.Property(c => c.ParentId)
            .HasColumnName("parent_id")
            .HasConversion(id => id == null ? (Guid?)null : id.Value, value => value == null ? null : new CategoryId(value.Value));

        builder.Property(c => c.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(c => c.SortOrder)
            .HasColumnName("sort_order")
            .HasDefaultValue(0);

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at");

        builder.Ignore(c => c.DomainEvents);
    }
}
