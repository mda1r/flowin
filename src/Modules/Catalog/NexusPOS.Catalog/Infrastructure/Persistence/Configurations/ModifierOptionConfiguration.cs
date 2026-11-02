using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.Infrastructure.Persistence.Configurations;

internal sealed class ModifierOptionConfiguration : IEntityTypeConfiguration<ModifierOption>
{
    public void Configure(EntityTypeBuilder<ModifierOption> builder)
    {
        builder.ToTable("modifier_options");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, value => new ModifierOptionId(value))
            .ValueGeneratedNever();

        builder.Property(o => o.GroupId)
            .HasColumnName("group_id")
            .HasConversion(id => id.Value, value => new ModifierGroupId(value));

        builder.Property(o => o.NameEn)
            .HasColumnName("name_en")
            .HasMaxLength(EnglishName.MaxLength);

        builder.Property(o => o.Name)
            .HasColumnName("name")
            .HasMaxLength(ModifierGroup.NameMaxLength)
            .IsRequired();

        builder.Property(o => o.PriceDelta)
            .HasColumnName("price_delta")
            .HasPrecision(18, 4);

        builder.Property(o => o.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(o => o.SortOrder).HasColumnName("sort_order");

        builder.HasIndex(o => o.GroupId)
            .HasDatabaseName("ix_modifier_options_group_id");
    }
}
