using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NexusPOS.Sales.Domain.Entities;
using NexusPOS.Sales.Domain.ValueObjects;

namespace NexusPOS.Sales.Infrastructure.Persistence.Configurations;

internal sealed class SalesSummaryConfiguration : IEntityTypeConfiguration<SalesSummary>
{
    public void Configure(EntityTypeBuilder<SalesSummary> builder)
    {
        builder.ToTable("sales_summaries");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id)
            .HasColumnName("id")
            .HasConversion(id => id.Value, v => new SalesSummaryId(v));

        builder.Property(s => s.BranchId).HasColumnName("branch_id");
        builder.Property(s => s.SummaryDate).HasColumnName("summary_date");
        builder.Property(s => s.Currency).HasColumnName("currency").HasMaxLength(3);
        builder.Property(s => s.TotalOrders).HasColumnName("total_orders");
        builder.Property(s => s.TotalRevenue).HasColumnName("total_revenue").HasPrecision(18, 4);
        builder.Property(s => s.TotalDiscounts).HasColumnName("total_discounts").HasPrecision(18, 4);
        builder.Property(s => s.TotalTax).HasColumnName("total_tax").HasPrecision(18, 4);

        builder.Ignore(s => s.AverageOrderValue);
        builder.Ignore(s => s.DomainEvents);

        builder.HasIndex(s => new { s.BranchId, s.SummaryDate })
            .IsUnique()
            .HasDatabaseName("ux_sales_summaries_branch_date");
    }
}
