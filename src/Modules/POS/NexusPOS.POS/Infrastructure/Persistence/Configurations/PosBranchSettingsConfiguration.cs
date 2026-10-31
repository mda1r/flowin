using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.POS.Domain.Entities;

namespace NexusPOS.POS.Infrastructure.Persistence.Configurations;

internal sealed class PosBranchSettingsConfiguration : IEntityTypeConfiguration<PosBranchSettings>
{
    public void Configure(EntityTypeBuilder<PosBranchSettings> builder)
    {
        builder.ToTable("pos_branch_settings");

        builder.HasKey(s => s.BranchId);
        builder.Property(s => s.BranchId).HasColumnName("branch_id").ValueGeneratedNever();
        builder.Property(s => s.TenantId).HasColumnName("tenant_id");
        builder.Property(s => s.MaxCashierDiscountPercent).HasColumnName("max_cashier_discount_percent").HasPrecision(5, 2);
        builder.Property(s => s.ApprovalPinHash).HasColumnName("approval_pin_hash").HasMaxLength(200);
        builder.Property(s => s.FailedPinAttempts).HasColumnName("failed_pin_attempts");
        builder.Property(s => s.PinLockedUntil).HasColumnName("pin_locked_until");
        builder.Property(s => s.UpdatedAt).HasColumnName("updated_at");
    }
}
