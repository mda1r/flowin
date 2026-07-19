using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Gaming.Domain.Entities;

namespace NexusPOS.Gaming.Infrastructure.Persistence.Configurations;

internal sealed class GameSessionConfiguration : IEntityTypeConfiguration<GameSession>
{
    public void Configure(EntityTypeBuilder<GameSession> builder)
    {
        builder.ToTable("game_sessions");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id).HasColumnName("id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(e => e.BranchId).HasColumnName("branch_id").IsRequired();
        builder.Property(e => e.StationId).HasColumnName("station_id").IsRequired();
        builder.Property(e => e.PlayerName).HasColumnName("player_name").HasMaxLength(128).IsRequired();
        builder.Property(e => e.StartTime).HasColumnName("start_time").IsRequired();
        builder.Property(e => e.EndTime).HasColumnName("end_time");
        builder.Property(e => e.DurationMinutes).HasColumnName("duration_minutes").IsRequired();
        builder.Property(e => e.RatePerHour).HasColumnName("rate_per_hour").HasPrecision(18, 4).IsRequired();
        builder.Property(e => e.TotalAmount).HasColumnName("total_amount").HasPrecision(18, 4).IsRequired();

        builder.Property(e => e.Status)
            .HasConversion<string>()
            .HasColumnName("status")
            .HasMaxLength(16)
            .IsRequired();

        builder.HasIndex(e => e.BranchId).HasDatabaseName("ix_game_sessions_branch_id");
        builder.HasIndex(e => e.StationId).HasDatabaseName("ix_game_sessions_station_id");
        builder.HasIndex(e => new { e.StationId, e.Status }).HasDatabaseName("ix_game_sessions_station_status");
        builder.HasIndex(e => new { e.BranchId, e.Status }).HasDatabaseName("ix_game_sessions_branch_status");
    }
}
