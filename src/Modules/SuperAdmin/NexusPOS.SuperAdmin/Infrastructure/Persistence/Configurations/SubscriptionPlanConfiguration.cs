using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.SuperAdmin.Domain.Entities;

namespace NexusPOS.SuperAdmin.Infrastructure.Persistence.Configurations;

internal sealed class SubscriptionPlanConfiguration : IEntityTypeConfiguration<SubscriptionPlan>
{
    public void Configure(EntityTypeBuilder<SubscriptionPlan> builder)
    {
        builder.ToTable("subscription_plans", "superadmin");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id).HasColumnName("id");

        builder.Property(p => p.Name)
            .HasColumnName("name")
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(p => p.BusinessType)
            .HasColumnName("business_type")
            .HasMaxLength(50);

        builder.Property(p => p.Price)
            .HasColumnName("price")
            .HasPrecision(18, 2);

        builder.Property(p => p.MaxBranches).HasColumnName("max_branches");

        builder.Property(p => p.MaxUsers).HasColumnName("max_users");

        builder.Property(p => p.Features)
            .HasColumnName("features")
            .HasColumnType("text[]");

        builder.Property(p => p.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(p => p.CreatedAt).HasColumnName("created_at");
    }
}
