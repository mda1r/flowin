using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.ValueObjects;

namespace NexusPOS.Purchasing.Infrastructure.Persistence.Configurations;

internal sealed class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> builder)
    {
        builder.ToTable("suppliers");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasConversion(id => id.Value, value => new SupplierId(value))
            .HasColumnName("id");

        builder.Property(s => s.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(s => s.Name).HasColumnName("name").HasMaxLength(256).IsRequired();
        builder.Property(s => s.ContactEmail).HasColumnName("contact_email").HasMaxLength(256);
        builder.Property(s => s.ContactPhone).HasColumnName("contact_phone").HasMaxLength(32);
        builder.Property(s => s.Address).HasColumnName("address").HasMaxLength(512);
        builder.Property(s => s.IsActive).HasColumnName("is_active").IsRequired();
        builder.Property(s => s.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(s => s.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasIndex(s => new { s.TenantId, s.Name }).IsUnique().HasDatabaseName("ix_suppliers_tenant_name");
        builder.HasIndex(s => s.TenantId).HasDatabaseName("ix_suppliers_tenant_id");

        builder.Ignore(s => s.DomainEvents);
    }
}
