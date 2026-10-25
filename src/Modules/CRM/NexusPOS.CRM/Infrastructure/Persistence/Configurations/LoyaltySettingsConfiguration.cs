using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.CRM.Domain.Entities;

namespace NexusPOS.CRM.Infrastructure.Persistence.Configurations;

internal sealed class LoyaltySettingsConfiguration : IEntityTypeConfiguration<LoyaltySettings>
{
    public void Configure(EntityTypeBuilder<LoyaltySettings> builder)
    {
        builder.ToTable("loyalty_settings");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id");
        builder.Property(s => s.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(s => s.Enabled).HasColumnName("enabled");
        builder.Property(s => s.PointsPerCurrencyUnit).HasColumnName("points_per_currency_unit").HasPrecision(18, 4);
        builder.Property(s => s.RedeemPoints).HasColumnName("redeem_points");
        builder.Property(s => s.RedeemValue).HasColumnName("redeem_value").HasPrecision(18, 4);
        builder.Property(s => s.MinRedeemPoints).HasColumnName("min_redeem_points");
        builder.Property(s => s.UpdatedAt).HasColumnName("updated_at");
        builder.HasIndex(s => s.TenantId).IsUnique().HasDatabaseName("ix_loyalty_settings_tenant");
    }
}
