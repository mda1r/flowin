using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Domain.Enums;

namespace NexusPOS.SuperAdmin.Infrastructure.Persistence.Configurations;

internal sealed class TenantSubscriptionConfiguration : IEntityTypeConfiguration<TenantSubscription>
{
    public void Configure(EntityTypeBuilder<TenantSubscription> builder)
    {
        builder.ToTable("tenant_subscriptions", "superadmin");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id).HasColumnName("id");
        builder.Property(s => s.TenantId).HasColumnName("tenant_id");
        builder.Property(s => s.PlanId).HasColumnName("plan_id");
        builder.Property(s => s.StartDate).HasColumnName("start_date");
        builder.Property(s => s.ExpiryDate).HasColumnName("expiry_date");

        builder.Property(s => s.Status)
            .HasColumnName("status")
            .HasConversion<int>()
            .HasDefaultValue(SubscriptionStatus.Active);

        builder.Property(s => s.MaxBranches).HasColumnName("max_branches");
        builder.Property(s => s.MaxUsers).HasColumnName("max_users");

        builder.Property(s => s.Notes)
            .HasColumnName("notes")
            .HasMaxLength(1024);

        builder.Property(s => s.CreatedAt).HasColumnName("created_at");

        builder.HasOne(s => s.Plan)
            .WithMany()
            .HasForeignKey(s => s.PlanId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(s => s.TenantId).HasDatabaseName("ix_tenant_subscriptions_tenant_id");
        builder.HasIndex(s => new { s.TenantId, s.Status }).HasDatabaseName("ix_tenant_subscriptions_tenant_status");
    }
}
