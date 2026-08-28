using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Tax.Domain.Entities;

namespace NexusPOS.Tax.Infrastructure.Persistence.Configurations;

internal sealed class TaxRegistrationScopeConfiguration : IEntityTypeConfiguration<TaxRegistrationScope>
{
    public void Configure(EntityTypeBuilder<TaxRegistrationScope> builder)
    {
        builder.ToTable("tax_registration_scopes");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id");

        builder.Property(s => s.BrandId).HasColumnName("brand_id");

        builder.Property(s => s.Name)
            .HasColumnName("name")
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(s => s.VatRegistrationNumber)
            .HasColumnName("vat_registration_number")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(s => s.LegalEntityName)
            .HasColumnName("legal_entity_name")
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(s => s.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(s => s.CreatedAt).HasColumnName("created_at");
        builder.Property(s => s.UpdatedAt).HasColumnName("updated_at");
        builder.Property(s => s.CreatedBy).HasColumnName("created_by");

        builder.HasIndex(s => s.BrandId)
            .HasDatabaseName("ix_tax_registration_scopes_brand_id");

        builder.HasMany(s => s.Memberships)
            .WithOne(m => m.Scope)
            .HasForeignKey(m => m.TaxScopeId);
    }
}
