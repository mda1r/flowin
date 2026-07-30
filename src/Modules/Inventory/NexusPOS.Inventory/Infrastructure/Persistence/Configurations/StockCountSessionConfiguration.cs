using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Domain.ValueObjects;

namespace NexusPOS.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class StockCountSessionConfiguration : IEntityTypeConfiguration<StockCountSession>
{
    public void Configure(EntityTypeBuilder<StockCountSession> builder)
    {
        builder.ToTable("stock_count_sessions");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, value => new StockCountSessionId(value));

        builder.Property(s => s.BranchId).HasColumnName("branch_id");
        builder.Property(s => s.Type).HasColumnName("type").HasConversion<int>();
        builder.Property(s => s.Status).HasColumnName("status").HasConversion<int>();
        builder.Property(s => s.PeriodStart).HasColumnName("period_start");
        builder.Property(s => s.PeriodEnd).HasColumnName("period_end");
        builder.Property(s => s.Notes).HasColumnName("notes").HasMaxLength(512);
        builder.Property(s => s.CreatedAt).HasColumnName("created_at");
        builder.Property(s => s.CompletedAt).HasColumnName("completed_at");

        builder.HasIndex(s => s.BranchId).HasDatabaseName("ix_stock_count_sessions_branch_id");
        builder.HasIndex(s => new { s.BranchId, s.CreatedAt }).HasDatabaseName("ix_stock_count_sessions_branch_date");

        builder.HasMany(s => s.Items)
            .WithOne()
            .HasForeignKey(i => i.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(s => s.DomainEvents);
        builder.Ignore(s => s.TotalItems);
        builder.Ignore(s => s.CountedItems);
        builder.Ignore(s => s.DiscrepancyCount);
        builder.Ignore(s => s.TotalSystemValue);
        builder.Ignore(s => s.TotalCountedValue);
        builder.Ignore(s => s.TotalTaxAmount);
    }
}
