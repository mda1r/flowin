using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Organization.Domain.Entities;

namespace NexusPOS.Organization.Infrastructure.Persistence.Configurations;

internal sealed class BrandConfiguration : IEntityTypeConfiguration<Brand>
{
    public void Configure(EntityTypeBuilder<Brand> builder)
    {
        builder.ToTable("brands");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.Id).HasColumnName("id");

        builder.Property(b => b.NameAr)
            .HasColumnName("name_ar")
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(b => b.NameEn)
            .HasColumnName("name_en")
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(b => b.Code)
            .HasColumnName("code")
            .HasMaxLength(64)
            .IsRequired();

        builder.HasIndex(b => b.Code)
            .IsUnique()
            .HasDatabaseName("ix_brands_code");

        builder.Property(b => b.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired()
            .HasDefaultValue(BrandStatus.Active);

        builder.Property(b => b.Notes)
            .HasColumnName("notes");

        builder.Property(b => b.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(b => b.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(b => b.CreatedBy)
            .HasColumnName("created_by");

        builder.HasMany(b => b.Memberships)
            .WithOne(m => m.Brand)
            .HasForeignKey(m => m.BrandId);
    }
}
