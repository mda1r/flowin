using FluentAssertions;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class CashierShiftRefundTests
{
    [Fact]
    public void Close_WithRefunds_TakesThemOffExpectedCashCardAndVat()
    {
        CashierShift shift = CashierShift.Open(Guid.NewGuid(), Guid.NewGuid(), "أحمد", 100m);
        ShiftTotals totals = ShiftTotals.From(
        [
            new ShiftPaymentRow(PaymentMethod.Cash, 2, 230m, 30m, 0m, 0m),
            new ShiftPaymentRow(PaymentMethod.Card, 1, 50m, 6.52m, 0m, 0m),
        ], new ShiftRefunds(Total: 55m, Cash: 45m, Card: 10m, Tax: 7.17m));

        shift.Close(closingCash: 285m, closingCardCount: 40m, totals, notes: null);

        shift.ExpectedCash.Should().Be(285m);
        shift.CashVariance.Should().Be(0m);
        shift.CardVariance.Should().Be(0m);
        shift.TotalTax.Should().Be(29.35m);
        shift.TotalRefunds.Should().Be(55m);
        shift.TotalCashRefunds.Should().Be(45m);
        shift.TotalSales.Should().Be(280m);
    }

    [Fact]
    public void Close_WithoutRefunds_KeepsTheSalesFigures()
    {
        CashierShift shift = CashierShift.Open(Guid.NewGuid(), Guid.NewGuid(), "أحمد", 100m);
        ShiftTotals totals = ShiftTotals.From([new ShiftPaymentRow(PaymentMethod.Cash, 1, 100m, 13m, 0m, 0m)], ShiftRefunds.None);

        shift.Close(200m, 0m, totals, null);

        shift.ExpectedCash.Should().Be(200m);
        shift.TotalRefunds.Should().Be(0m);
    }
}
