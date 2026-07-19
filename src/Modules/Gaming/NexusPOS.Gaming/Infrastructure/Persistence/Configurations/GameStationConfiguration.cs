using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.ValueObjects;

namespace NexusPOS.Gaming.Infrastructure.Persistence.Configurations;

internal sealed class GameStationConfiguration : IEntityTypeConfiguration<GameStation>
{
    public void Configure(EntityTypeBuilder<GameStation> builder)
    {
        builder.ToTable("game_stations");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasConversion(id => id.Value, value => new GameStationId(value))
            .HasColumnName("id");

        builder.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(e => e.BranchId).HasColumnName("branch_id").IsRequired();

        builder.Property(e => e.StationType)
            .HasConversion<string>()
            .HasColumnName("station_type")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(e => e.Name).HasColumnName("name").HasMaxLength(128).IsRequired();
        builder.Property(e => e.HourlyRate).HasColumnName("hourly_rate").HasPrecision(18, 4).IsRequired();
        builder.Property(e => e.Currency).HasColumnName("currency").HasMaxLength(3).IsRequired();

        builder.Property(e => e.Status)
            .HasConversion<string>()
            .HasColumnName("status")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(e => e.IsActive).HasColumnName("is_active").IsRequired();
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasIndex(e => e.BranchId).HasDatabaseName("ix_game_stations_branch_id");
        builder.HasIndex(e => new { e.BranchId, e.Status }).HasDatabaseName("ix_game_stations_branch_status");
        builder.HasIndex(e => new { e.BranchId, e.StationType }).HasDatabaseName("ix_game_stations_branch_type");

        builder.Ignore(e => e.DomainEvents);
    }
}
