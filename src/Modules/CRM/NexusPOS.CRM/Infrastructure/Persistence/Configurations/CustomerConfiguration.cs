using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.ValueObjects;

namespace NexusPOS.CRM.Infrastructure.Persistence.Configurations;

internal sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("customers");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasConversion(id => id.Value, value => new CustomerId(value))
            .HasColumnName("id");

        builder.Property(c => c.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(c => c.Name).HasColumnName("name").HasMaxLength(256).IsRequired();
        builder.Property(c => c.Email).HasColumnName("email").HasMaxLength(256);
        builder.Property(c => c.Phone).HasColumnName("phone").HasMaxLength(32);
        builder.Property(c => c.Address).HasColumnName("address").HasMaxLength(512);
        builder.Property(c => c.DateOfBirth).HasColumnName("date_of_birth");
        builder.Property(c => c.LoyaltyPoints).HasColumnName("loyalty_points").IsRequired();
        builder.Property(c => c.Notes).HasColumnName("notes").HasMaxLength(2048);
        builder.Property(c => c.IsActive).HasColumnName("is_active").IsRequired();
        builder.Property(c => c.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(c => c.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasIndex(c => new { c.TenantId, c.Email })
            .IsUnique()
            .HasFilter("email IS NOT NULL")
            .HasDatabaseName("ix_customers_tenant_email");

        builder.HasIndex(c => c.TenantId).HasDatabaseName("ix_customers_tenant_id");

        builder.Ignore(c => c.DomainEvents);
    }
}
