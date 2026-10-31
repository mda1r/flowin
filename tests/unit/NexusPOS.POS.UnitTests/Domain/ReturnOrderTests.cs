using ErrorOr;
using FluentAssertions;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Events;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class ReturnOrderTests
{
    private static readonly Guid _customer = Guid.NewGuid();

    private static void Complete(Order order) =>
        order.Complete(PaymentMethod.Cash, order.TotalAmount + 100m).IsError.Should().BeFalse();

    private static Order NewOrder(Guid? customerId = null) =>
        Order.Create(Guid.NewGuid(), Guid.NewGuid(), "SAR", customerId, taxRate: 0.15m);

    private static ErrorOr<ReturnOrder> Return(
        Order order, IEnumerable<ReturnOrder> earlier, params (OrderLine line, decimal qty)[] lines) =>
        ReturnOrder.Create(
            order, earlier,
            lines.Select(l => (l.line.Id.Value, l.qty, ReturnReason.CustomerRequest)),
            RefundMethod.Cash);

    [Fact]
    public void Create_NoDiscount_RefundsPriceWithVat()
    {
        Order order = NewOrder();
        OrderLine line = order.AddLine(Guid.NewGuid(), "قهوة", "وسط", 100m, 0m, 2m).Value;
        Complete(order);

        ReturnOrder ret = Return(order, [], (line, 1m)).Value;

        ret.RefundAmount.Should().Be(115m);
        ret.Lines[0].UnitPrice.Should().Be(100m);
    }

    [Fact]
    public void Create_LineDiscount_RefundsWhatWasActuallyPaid()
    {
        Order order = NewOrder();
        Discount twentyPercent = Discount.Create(DiscountType.Percentage, 20m).Value;
        OrderLine line = order.AddLine(Guid.NewGuid(), "ساعة", "أسود", 100m, 0m, 1m, twentyPercent).Value;
        Complete(order);

        ReturnOrder ret = Return(order, [], (line, 1m)).Value;

        ret.RefundAmount.Should().Be(92m);
    }

    [Fact]
    public void Create_OrderDiscount_IsSharedAcrossLines()
    {
        Order order = NewOrder();
        OrderLine first = order.AddLine(Guid.NewGuid(), "أ", "", 100m, 0m, 1m).Value;
        order.AddLine(Guid.NewGuid(), "ب", "", 100m, 0m, 1m);
        order.ApplyDiscount(DiscountType.Fixed, 50m);
        Complete(order);

        // 200 net less 50 off is 150, so each 100 item cost 75 plus VAT.
        ReturnOrder ret = Return(order, [], (first, 1m)).Value;

        ret.RefundAmount.Should().Be(86.25m);
        order.GrossUnitPaid(first).Should().Be(86.25m);
    }

    [Fact]
    public void Create_LoyaltyDiscount_IsTakenOffTheRefund()
    {
        Order order = NewOrder(_customer);
        OrderLine line = order.AddLine(Guid.NewGuid(), "لاتيه", "كبير", 100m, 0m, 1m).Value;
        order.RedeemLoyaltyPoints(100, LoyaltyRules.Default.ValuePerPoint);
        Complete(order);

        ReturnOrder ret = Return(order, [], (line, 1m)).Value;

        ret.RefundAmount.Should().Be(order.TotalAmount);
        Math.Round(ret.RefundAmount, 2).Should().Be(110m);
    }

    [Fact]
    public void Create_PartialThenRest_RefundsExactlyTheBill()
    {
        Order order = NewOrder();
        OrderLine line = order.AddLine(Guid.NewGuid(), "ماء", "", 1m, 0m, 3m).Value;
        order.ApplyDiscount(DiscountType.Fixed, 0.1m);
        Complete(order);

        ReturnOrder first = Return(order, [], (line, 1m)).Value;
        ReturnOrder second = Return(order, [first], (line, 2m)).Value;

        (first.RefundAmount + second.RefundAmount).Should().Be(order.TotalAmount);
    }

    [Fact]
    public void Create_MoreThanSold_IsRejected()
    {
        Order order = NewOrder();
        OrderLine line = order.AddLine(Guid.NewGuid(), "قهوة", "", 10m, 0m, 2m).Value;
        Complete(order);
        ReturnOrder first = Return(order, [], (line, 2m)).Value;

        ErrorOr<ReturnOrder> again = Return(order, [first], (line, 1m));

        again.FirstError.Code.Should().Be("ReturnOrder.QuantityExceeded");
    }

    [Fact]
    public void Create_SameLineTwice_IsRejected()
    {
        Order order = NewOrder();
        OrderLine line = order.AddLine(Guid.NewGuid(), "قهوة", "", 10m, 0m, 2m).Value;
        Complete(order);

        ErrorOr<ReturnOrder> result = Return(order, [], (line, 2m), (line, 2m));

        result.FirstError.Code.Should().Be("ReturnOrder.DuplicateLine");
    }

    [Fact]
    public void Create_OpenOrder_IsRejected()
    {
        Order order = NewOrder();
        OrderLine line = order.AddLine(Guid.NewGuid(), "قهوة", "", 10m, 0m, 1m).Value;

        Return(order, [], (line, 1m)).FirstError.Code.Should().Be("ReturnOrder.OrderNotCompleted");
    }

    [Fact]
    public void Create_UnknownLine_IsRejected()
    {
        Order order = NewOrder();
        order.AddLine(Guid.NewGuid(), "قهوة", "", 10m, 0m, 1m);
        Complete(order);

        ErrorOr<ReturnOrder> result = ReturnOrder.Create(
            order, [], [(Guid.NewGuid(), 1m, ReturnReason.Other)], RefundMethod.Cash);

        result.FirstError.Should().Be(PosErrors.OrderLineNotFound);
    }

    [Fact]
    public void Create_RecordsWhoAndWhy_AndPutsTheVatInTheEvent()
    {
        Order order = NewOrder();
        OrderLine line = order.AddLine(Guid.NewGuid(), "قهوة", "", 100m, 0m, 1m).Value;
        Complete(order);
        Guid user = Guid.NewGuid();
        Guid shift = Guid.NewGuid();

        ReturnOrder ret = ReturnOrder.Create(
            order, [], [(line.Id.Value, 1m, ReturnReason.DefectiveProduct)], RefundMethod.Card,
            createdByUserId: user, createdByName: " سارة ", shiftId: shift, note: "  مكسور  ").Value;

        ret.CreatedByUserId.Should().Be(user);
        ret.CreatedByName.Should().Be("سارة");
        ret.ShiftId.Should().Be(shift);
        ret.Note.Should().Be("مكسور");
        ReturnOrderCompletedDomainEvent evt = ret.DomainEvents.OfType<ReturnOrderCompletedDomainEvent>().Single();
        evt.RefundAmount.Should().Be(115m);
        evt.TaxAmount.Should().Be(15m);
    }

    [Fact]
    public void RefundTaxOf_SplitsTheVatOutOfAnInclusiveAmount()
    {
        ReturnOrder.RefundTaxOf(115m, 0.15m).Should().Be(15m);
        ReturnOrder.RefundTaxOf(50m, 0m).Should().Be(0m);
    }
}
