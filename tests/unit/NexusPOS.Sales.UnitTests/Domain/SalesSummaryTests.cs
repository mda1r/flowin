using FluentAssertions;
using NexusPOS.Sales.Domain.Entities;

namespace NexusPOS.Sales.UnitTests.Domain;

public sealed class SalesSummaryTests
{
    private static readonly Guid _branchId = Guid.NewGuid();
    private static readonly DateOnly _today = DateOnly.FromDateTime(DateTime.UtcNow);

    [Fact]
    public void CreateForDate_InitializesWithZeroTotals()
    {
        SalesSummary summary = SalesSummary.CreateForDate(_branchId, _today, "USD");

        summary.BranchId.Should().Be(_branchId);
        summary.SummaryDate.Should().Be(_today);
        summary.Currency.Should().Be("USD");
        summary.TotalOrders.Should().Be(0);
        summary.TotalRevenue.Should().Be(0m);
        summary.TotalDiscounts.Should().Be(0m);
        summary.TotalTax.Should().Be(0m);
        summary.AverageOrderValue.Should().Be(0m);
    }

    [Fact]
    public void RecordSale_SingleSale_UpdatesTotalsCorrectly()
    {
        SalesSummary summary = SalesSummary.CreateForDate(_branchId, _today, "USD");

        summary.RecordSale(100m, 10m, 5m);

        summary.TotalOrders.Should().Be(1);
        summary.TotalRevenue.Should().Be(100m);
        summary.TotalDiscounts.Should().Be(10m);
        summary.TotalTax.Should().Be(5m);
    }

    [Fact]
    public void RecordSale_MultipleSales_AccumulatesTotals()
    {
        SalesSummary summary = SalesSummary.CreateForDate(_branchId, _today, "USD");

        summary.RecordSale(100m, 10m, 5m);
        summary.RecordSale(200m, 0m, 20m);
        summary.RecordSale(150m, 15m, 10m);

        summary.TotalOrders.Should().Be(3);
        summary.TotalRevenue.Should().Be(450m);
        summary.TotalDiscounts.Should().Be(25m);
        summary.TotalTax.Should().Be(35m);
    }

    [Fact]
    public void AverageOrderValue_WithMultipleSales_ComputesCorrectly()
    {
        SalesSummary summary = SalesSummary.CreateForDate(_branchId, _today, "USD");

        summary.RecordSale(100m, 0m, 0m);
        summary.RecordSale(200m, 0m, 0m);

        summary.AverageOrderValue.Should().Be(150m);
    }

    [Fact]
    public void AverageOrderValue_NoSales_ReturnsZero()
    {
        SalesSummary summary = SalesSummary.CreateForDate(_branchId, _today, "USD");

        summary.AverageOrderValue.Should().Be(0m);
    }

    [Fact]
    public void RecordSale_ZeroAmounts_IncrementsOrderCount()
    {
        SalesSummary summary = SalesSummary.CreateForDate(_branchId, _today, "USD");

        summary.RecordSale(0m, 0m, 0m);

        summary.TotalOrders.Should().Be(1);
        summary.TotalRevenue.Should().Be(0m);
    }
}
