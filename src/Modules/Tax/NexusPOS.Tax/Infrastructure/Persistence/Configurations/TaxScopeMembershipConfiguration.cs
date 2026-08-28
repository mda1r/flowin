using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Tax.Domain.Entities;

namespace NexusPOS.Tax.Infrastructure.Persistence.Configurations;

internal sealed class TaxScopeMembershipConfiguration : IEntityTypeConfiguration<TaxScopeMembership>
{
    public void Configure(EntityTypeBuilder<TaxScopeMembership> builder)
    {
        builder.ToTable("tax_scope_memberships");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).HasColumnName("id");

        builder.Property(m => m.TaxScopeId).HasColumnName("tax_scope_id");
        builder.Property(m => m.TenantId).HasColumnName("tenant_id");

        builder.Property(m => m.EffectiveFrom).HasColumnName("effective_from");
        builder.Property(m => m.EffectiveTo).HasColumnName("effective_to");

        builder.Property(m => m.AddedAt).HasColumnName("added_at");
        builder.Property(m => m.AddedBy).HasColumnName("added_by");
        builder.Property(m => m.RemovedAt).HasColumnName("removed_at");
        builder.Property(m => m.RemovedBy).HasColumnName("removed_by");
        builder.Property(m => m.RemovalReason).HasColumnName("removal_reason");

        builder.HasIndex(m => new { m.TenantId, m.EffectiveFrom })
            .HasDatabaseName("ix_tax_scope_memberships_tenant_effective");

        builder.HasIndex(m => m.TaxScopeId)
            .HasDatabaseName("ix_tax_scope_memberships_scope_id");
    }
}
