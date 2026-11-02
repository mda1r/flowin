using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.Infrastructure.Persistence.Configurations;

internal sealed class ModifierGroupConfiguration : IEntityTypeConfiguration<ModifierGroup>
{
    public void Configure(EntityTypeBuilder<ModifierGroup> builder)
    {
        builder.ToTable("modifier_groups");

        builder.HasKey(g => g.Id);

        builder.Property(g => g.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, value => new ModifierGroupId(value))
            .ValueGeneratedNever();

        builder.Property(g => g.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(g => g.NameEn)
            .HasColumnName("name_en")
            .HasMaxLength(EnglishName.MaxLength);

        builder.Property(g => g.Name)
            .HasColumnName("name")
            .HasMaxLength(ModifierGroup.NameMaxLength)
            .IsRequired();

        builder.Property(g => g.IsRequired).HasColumnName("is_required");
        builder.Property(g => g.MinSelect).HasColumnName("min_select");
        builder.Property(g => g.MaxSelect).HasColumnName("max_select");
        builder.Property(g => g.SortOrder).HasColumnName("sort_order");

        builder.Property(g => g.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(g => g.CreatedAt).HasColumnName("created_at");

        // A new table, so EnsureCreated builds this index with it.
        builder.HasIndex(g => g.TenantId)
            .HasDatabaseName("ix_modifier_groups_tenant_id");

        builder.HasMany(g => g.Options)
            .WithOne()
            .HasForeignKey(o => o.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(g => g.DomainEvents);
    }
}
