using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Enums;
using NexusPOS.Organization.Domain.ValueObjects;

namespace NexusPOS.Organization.Infrastructure.Persistence.Configurations;

internal sealed class BranchConfiguration : IEntityTypeConfiguration<Branch>
{
    public void Configure(EntityTypeBuilder<Branch> builder)
    {
        builder.ToTable("branches");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.Id)
            .HasColumnName("id")
            .HasConversion(
                id => id.Value,
                value => new BranchId(value));

        builder.Property(b => b.TenantId)
            .HasColumnName("tenant_id")
            .HasConversion(
                id => id.Value,
                value => new TenantId(value))
            .IsRequired();

        builder.HasIndex(b => b.TenantId)
            .HasDatabaseName("ix_branches_tenant_id");

        builder.Property(b => b.Name)
            .HasColumnName("name")
            .HasMaxLength(256)
            .IsRequired();

        builder.HasIndex(b => new { b.TenantId, b.Name })
            .IsUnique()
            .HasDatabaseName("ix_branches_tenant_name");

        builder.Property(b => b.Type)
            .HasColumnName("type")
            .HasConversion<int>()
            .HasDefaultValue(BranchType.Retail);

        builder.Property(b => b.PhoneNumber)
            .HasColumnName("phone_number")
            .HasMaxLength(32);

        builder.Property(b => b.Email)
            .HasColumnName("email")
            .HasMaxLength(256);

        builder.Property(b => b.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(b => b.IsMainBranch)
            .HasColumnName("is_main_branch")
            .HasDefaultValue(false);

        builder.Property(b => b.CreatedAt)
            .HasColumnName("created_at");

        builder.OwnsOne(b => b.Address, nav =>
        {
            nav.Property(a => a.Street).HasColumnName("address_street").HasMaxLength(256);
            nav.Property(a => a.City).HasColumnName("address_city").HasMaxLength(128);
            nav.Property(a => a.State).HasColumnName("address_state").HasMaxLength(128);
            nav.Property(a => a.Country).HasColumnName("address_country").HasMaxLength(128);
            nav.Property(a => a.PostalCode).HasColumnName("address_postal_code").HasMaxLength(16);
        });

        builder.Ignore(b => b.DomainEvents);
    }
}
