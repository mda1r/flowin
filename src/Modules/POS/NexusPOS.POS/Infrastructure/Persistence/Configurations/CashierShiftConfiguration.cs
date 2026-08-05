using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.Infrastructure.Persistence.Configurations;

internal sealed class CashierShiftConfiguration : IEntityTypeConfiguration<CashierShift>
{
    public void Configure(EntityTypeBuilder<CashierShift> builder)
    {
        builder.ToTable("cashier_shifts");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, v => new CashierShiftId(v));

        builder.Property(s => s.BranchId).HasColumnName("branch_id");
        builder.Property(s => s.UserId).HasColumnName("user_id");
        builder.Property(s => s.CashierName).HasColumnName("cashier_name").HasMaxLength(200);
        builder.Property(s => s.Status).HasColumnName("status");
        builder.Property(s => s.OpeningCash).HasColumnName("opening_cash").HasPrecision(18, 4);
        builder.Property(s => s.ClosingCash).HasColumnName("closing_cash").HasPrecision(18, 4);
        builder.Property(s => s.TotalSales).HasColumnName("total_sales").HasPrecision(18, 4);
        builder.Property(s => s.TotalCashSales).HasColumnName("total_cash_sales").HasPrecision(18, 4);
        builder.Property(s => s.TotalCardSales).HasColumnName("total_card_sales").HasPrecision(18, 4);
        builder.Property(s => s.TotalTax).HasColumnName("total_tax").HasPrecision(18, 4);
        builder.Property(s => s.TotalOrders).HasColumnName("total_orders");
        builder.Property(s => s.ExpectedCash).HasColumnName("expected_cash").HasPrecision(18, 4);
        builder.Property(s => s.CashVariance).HasColumnName("cash_variance").HasPrecision(18, 4);
        builder.Property(s => s.ClosingCardCount).HasColumnName("closing_card_count").HasPrecision(18, 4);
        builder.Property(s => s.CardVariance).HasColumnName("card_variance").HasPrecision(18, 4);
        builder.Property(s => s.Notes).HasColumnName("notes").HasMaxLength(1000);
        builder.Property(s => s.OpenedAt).HasColumnName("opened_at");
        builder.Property(s => s.ClosedAt).HasColumnName("closed_at");

        builder.HasIndex(s => new { s.BranchId, s.UserId, s.Status })
            .HasDatabaseName("ix_cashier_shifts_branch_user_status");
        builder.HasIndex(s => s.OpenedAt).HasDatabaseName("ix_cashier_shifts_opened_at");
    }
}
