using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Organization.Domain.Entities;

namespace NexusPOS.Organization.Infrastructure.Persistence.Configurations;

internal sealed class TenantBrandMembershipConfiguration : IEntityTypeConfiguration<TenantBrandMembership>
{
    public void Configure(EntityTypeBuilder<TenantBrandMembership> builder)
    {
        builder.ToTable("tenant_brand_memberships");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id).HasColumnName("id");

        builder.Property(m => m.BrandId).HasColumnName("brand_id");

        builder.Property(m => m.TenantId).HasColumnName("tenant_id");

        builder.Property(m => m.BranchDisplayName)
            .HasColumnName("branch_display_name")
            .HasMaxLength(256);

        builder.Property(m => m.BranchCode)
            .HasColumnName("branch_code")
            .HasMaxLength(64);

        builder.Property(m => m.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired()
            .HasDefaultValue(MembershipStatus.Active);

        builder.Property(m => m.LinkedAt).HasColumnName("linked_at");
        builder.Property(m => m.LinkedBy).HasColumnName("linked_by");
        builder.Property(m => m.UnlinkedAt).HasColumnName("unlinked_at");
        builder.Property(m => m.UnlinkedBy).HasColumnName("unlinked_by");

        builder.HasIndex(m => m.BrandId)
            .HasDatabaseName("ix_tenant_brand_memberships_brand_id");

        // Partial unique index enforced at DB level via SQL patch
        builder.HasIndex(m => m.TenantId)
            .HasDatabaseName("ix_tenant_brand_memberships_tenant_id");
    }
}
