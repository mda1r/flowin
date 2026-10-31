using FluentAssertions;
using NexusPOS.POS.Domain.Entities;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class CashierShiftRefundTests
{
    [Fact]
    public void Close_WithRefunds_TakesThemOffExpectedCashCardAndVat()
    {
        CashierShift shift = CashierShift.Open(Guid.NewGuid(), Guid.NewGuid(), "أحمد", 100m);

        shift.Close(
            closingCash: 285m, closingCardCount: 40m,
            totalSales: 280m, totalCashSales: 230m, totalCardSales: 50m, totalTax: 36.52m, totalOrders: 3,
            notes: null, refunds: new ShiftRefunds(Total: 55m, Cash: 45m, Card: 10m, Tax: 7.17m));

        shift.ExpectedCash.Should().Be(285m);
        shift.CashVariance.Should().Be(0m);
        shift.CardVariance.Should().Be(0m);
        shift.TotalTax.Should().Be(29.35m);
        shift.TotalRefunds.Should().Be(55m);
        shift.CashRefunds.Should().Be(45m);
        shift.TotalSales.Should().Be(280m);
    }

    [Fact]
    public void Close_WithoutRefunds_KeepsTheSalesFigures()
    {
        CashierShift shift = CashierShift.Open(Guid.NewGuid(), Guid.NewGuid(), "أحمد", 100m);

        shift.Close(200m, 0m, 100m, 100m, 0m, 13m, 1, null);

        shift.ExpectedCash.Should().Be(200m);
        shift.TotalRefunds.Should().Be(0m);
    }
}
