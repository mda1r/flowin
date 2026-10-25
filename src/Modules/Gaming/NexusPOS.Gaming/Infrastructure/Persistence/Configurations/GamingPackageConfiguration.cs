using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Gaming.Domain.Entities;

namespace NexusPOS.Gaming.Infrastructure.Persistence.Configurations;

internal sealed class GamingPackageConfiguration : IEntityTypeConfiguration<GamingPackage>
{
    public void Configure(EntityTypeBuilder<GamingPackage> builder)
    {
        builder.ToTable("gaming_packages");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasColumnName("id");
        builder.Property(p => p.TenantId).HasColumnName("tenant_id");
        builder.Property(p => p.BranchId).HasColumnName("branch_id");
        builder.Property(p => p.Name).HasColumnName("name").HasMaxLength(100);
        builder.Property(p => p.DurationMinutes).HasColumnName("duration_minutes");
        builder.Property(p => p.Price).HasColumnName("price").HasPrecision(18, 4);
        builder.Property(p => p.StationType).HasColumnName("station_type").HasConversion<string>().HasMaxLength(32);
        builder.Property(p => p.IsActive).HasColumnName("is_active");
        builder.Property(p => p.CreatedAt).HasColumnName("created_at");
        builder.HasIndex(p => new { p.BranchId, p.IsActive }).HasDatabaseName("ix_gaming_packages_branch");
    }
}
