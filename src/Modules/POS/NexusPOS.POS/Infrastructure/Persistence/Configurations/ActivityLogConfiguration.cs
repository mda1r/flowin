using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Infrastructure.Persistence.Configurations;

internal sealed class ActivityLogConfiguration : IEntityTypeConfiguration<ActivityLog>
{
    public void Configure(EntityTypeBuilder<ActivityLog> builder)
    {
        builder.ToTable("activity_logs");

        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, v => new ActivityLogId(v));

        builder.Property(l => l.BranchId).HasColumnName("branch_id");
        builder.Property(l => l.UserId).HasColumnName("user_id");
        builder.Property(l => l.UserName).HasColumnName("user_name").HasMaxLength(200);
        builder.Property(l => l.UserEmail).HasColumnName("user_email").HasMaxLength(255);
        builder.Property(l => l.Category).HasColumnName("category").HasMaxLength(50);
        builder.Property(l => l.Action).HasColumnName("action").HasMaxLength(500);
        builder.Property(l => l.Details).HasColumnName("details").HasMaxLength(2000);
        builder.Property(l => l.OccurredAt).HasColumnName("occurred_at");

        builder.HasIndex(l => l.OccurredAt).HasDatabaseName("ix_activity_logs_occurred_at");
        builder.HasIndex(l => new { l.BranchId, l.OccurredAt }).HasDatabaseName("ix_activity_logs_branch_occurred");
    }
}
