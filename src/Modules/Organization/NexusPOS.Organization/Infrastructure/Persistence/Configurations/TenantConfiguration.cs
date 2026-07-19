using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Organization.Domain.Entities;
using NexusPOS.Organization.Domain.Enums;
using NexusPOS.Organization.Domain.ValueObjects;

namespace NexusPOS.Organization.Infrastructure.Persistence.Configurations;

internal sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnName("id")
            .HasConversion(
                id => id.Value,
                value => new TenantId(value));

        builder.Property(t => t.Name)
            .HasColumnName("name")
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(t => t.Subdomain)
            .HasColumnName("subdomain")
            .HasMaxLength(63)
            .IsRequired();

        builder.HasIndex(t => t.Subdomain)
            .IsUnique()
            .HasDatabaseName("ix_tenants_subdomain");

        builder.Property(t => t.AdminEmail)
            .HasColumnName("admin_email")
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(t => t.Plan)
            .HasColumnName("plan")
            .HasConversion<int>()
            .HasDefaultValue(SubscriptionPlan.Free);

        builder.Property(t => t.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(t => t.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(t => t.SuspendedAt)
            .HasColumnName("suspended_at");

        builder.Property(t => t.Currency)
            .HasColumnName("currency")
            .HasMaxLength(3)
            .IsRequired();

        builder.Property(t => t.TimeZone)
            .HasColumnName("time_zone")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(t => t.LogoUrl)
            .HasColumnName("logo_url")
            .HasMaxLength(2048);

        builder.Property(t => t.PhoneNumber)
            .HasColumnName("phone_number")
            .HasMaxLength(32);

        builder.Property(t => t.TaxId)
            .HasColumnName("tax_id")
            .HasMaxLength(64);

        builder.Property(t => t.BusinessType)
            .HasColumnName("business_type")
            .HasConversion<int>()
            .HasDefaultValue(NexusPOS.Organization.Domain.Enums.BusinessType.Retail);

        builder.OwnsOne(t => t.Address, nav =>
        {
            nav.Property(a => a.Street).HasColumnName("address_street").HasMaxLength(256);
            nav.Property(a => a.City).HasColumnName("address_city").HasMaxLength(128);
            nav.Property(a => a.State).HasColumnName("address_state").HasMaxLength(128);
            nav.Property(a => a.Country).HasColumnName("address_country").HasMaxLength(128);
            nav.Property(a => a.PostalCode).HasColumnName("address_postal_code").HasMaxLength(16);
        });

        builder.Ignore(t => t.DomainEvents);
    }
}
