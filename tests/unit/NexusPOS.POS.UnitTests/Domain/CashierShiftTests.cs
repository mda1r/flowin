using FluentAssertions;
using NexusPOS.POS.Application.Commands.CloseShift;
using NexusPOS.POS.Application.Commands.OpenShift;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class CashierShiftTests
{
    private static CashierShift OpenShift(decimal openingCash = 200m) =>
        CashierShift.Open(Guid.NewGuid(), Guid.NewGuid(), "سارة", openingCash);

    [Fact]
    public void Totals_SplitPaymentsCountTheirCashAndCardPortions()
    {
        ShiftTotals totals = ShiftTotals.From(
        [
            new ShiftPaymentRow(PaymentMethod.Cash, 3, 300m, 39m, 0m, 0m),
            new ShiftPaymentRow(PaymentMethod.Card, 2, 115m, 15m, 0m, 0m),
            new ShiftPaymentRow(PaymentMethod.Split, 1, 100m, 13m, 60m, 40m),
        ], 0m);

        totals.CashSales.Should().Be(360m);
        totals.CardSales.Should().Be(155m);
        totals.DigitalSales.Should().Be(0m);
        totals.TotalSales.Should().Be(515m);
        totals.Orders.Should().Be(6);
        totals.Tax.Should().Be(67m);
    }

    [Fact]
    public void Totals_SplitRoundingLeftoverStaysInCashNotDigital()
    {
        // Two split bills whose 2-decimal halves miss the 4-decimal totals by under a halala, either way.
        ShiftTotals totals = ShiftTotals.From(
        [
            new ShiftPaymentRow(PaymentMethod.Cash, 1, 20m, 2.6m, 0m, 0m),
            new ShiftPaymentRow(PaymentMethod.Card, 1, 30m, 3.9m, 0m, 0m),
            new ShiftPaymentRow(PaymentMethod.Split, 2, 23.0083m, 3m, 13.00m, 10.01m),
        ], 0m);

        totals.DigitalSales.Should().Be(0m);
        totals.CardSales.Should().Be(40.01m);
        totals.CashSales.Should().Be(32.9983m);
        (totals.CashSales + totals.CardSales).Should().Be(totals.TotalSales);
    }

    [Fact]
    public void Totals_SplitCardLargerThanTheBillCannotPushBucketsNegative()
    {
        ShiftTotals totals = ShiftTotals.From(
            [new ShiftPaymentRow(PaymentMethod.Split, 1, 50m, 6.52m, 0m, 500m)], 0m);

        totals.CardSales.Should().Be(50m);
        totals.CashSales.Should().Be(0m);
        totals.DigitalSales.Should().Be(0m);
    }

    [Fact]
    public void Totals_DigitalSalesGetTheirOwnBucketSoTheBucketsAddUp()
    {
        ShiftTotals totals = ShiftTotals.From(
        [
            new ShiftPaymentRow(PaymentMethod.Cash, 1, 50m, 6.52m, 0m, 0m),
            new ShiftPaymentRow(PaymentMethod.Digital, 2, 80m, 10.43m, 0m, 0m),
            new ShiftPaymentRow(null, 1, 10m, 1.3m, 0m, 0m),
        ], 0m);

        totals.DigitalSales.Should().Be(90m);
        (totals.CashSales + totals.CardSales + totals.DigitalSales).Should().Be(totals.TotalSales);
    }

    [Fact]
    public void Close_CashRefundsComeOutOfExpectedCash()
    {
        CashierShift shift = OpenShift(openingCash: 200m);
        ShiftTotals totals = ShiftTotals.From([new ShiftPaymentRow(PaymentMethod.Cash, 4, 400m, 52m, 0m, 0m)], cashRefunds: 50m);

        // 200 float + 400 cash sales − 50 handed back = 550 in the drawer: no false shortage.
        shift.Close(550m, 0m, totals, null).IsError.Should().BeFalse();

        shift.ExpectedCash.Should().Be(550m);
        shift.CashVariance.Should().Be(0m);
        shift.TotalCashRefunds.Should().Be(50m);
        shift.Status.Should().Be(ShiftStatus.Closed);
    }

    [Fact]
    public void Close_StoresDigitalSalesAndCardVariance()
    {
        CashierShift shift = OpenShift(openingCash: 0m);
        ShiftTotals totals = ShiftTotals.From(
        [
            new ShiftPaymentRow(PaymentMethod.Card, 1, 100m, 13m, 0m, 0m),
            new ShiftPaymentRow(PaymentMethod.Digital, 1, 40m, 5.2m, 0m, 0m),
        ], 0m);

        shift.Close(0m, 95m, totals, "  ").IsError.Should().BeFalse();

        shift.TotalSales.Should().Be(140m);
        shift.TotalDigitalSales.Should().Be(40m);
        shift.CardVariance.Should().Be(-5m);
        shift.Notes.Should().BeNull();
        shift.ClosedByName.Should().BeNull();
    }

    [Fact]
    public void Close_RecordsTheManagerWhoClosedIt()
    {
        CashierShift shift = OpenShift();

        shift.Close(200m, 0m, ShiftTotals.Empty, "نسي الإغلاق", "أحمد المدير").IsError.Should().BeFalse();

        shift.ClosedByName.Should().Be("أحمد المدير");
        shift.Notes.Should().Be("نسي الإغلاق");
    }

    [Fact]
    public void Close_TwiceFails()
    {
        CashierShift shift = OpenShift();
        shift.Close(200m, 0m, ShiftTotals.Empty, null);

        shift.Close(200m, 0m, ShiftTotals.Empty, null).IsError.Should().BeTrue();
    }

    [Fact]
    public void OpenShiftValidator_RejectsNegativeOpeningCash()
    {
        OpenShiftCommandValidator validator = new();

        validator.Validate(new OpenShiftCommand(Guid.NewGuid(), Guid.NewGuid(), "سارة", -1m)).IsValid.Should().BeFalse();
        validator.Validate(new OpenShiftCommand(Guid.NewGuid(), Guid.NewGuid(), "سارة", 0m)).IsValid.Should().BeTrue();
    }

    [Fact]
    public void CloseShiftValidator_RejectsNegativeCounts()
    {
        CloseShiftCommandValidator validator = new();

        validator.Validate(new CloseShiftCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), -5m, 0m, null)).IsValid.Should().BeFalse();
        validator.Validate(new CloseShiftCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 10m, -1m, null)).IsValid.Should().BeFalse();
        validator.Validate(new CloseShiftCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 10m, 0m, null)).IsValid.Should().BeTrue();
    }
}
