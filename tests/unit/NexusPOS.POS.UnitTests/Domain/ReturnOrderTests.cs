using FluentAssertions;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class ReturnOrderTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly Guid _branchId = Guid.NewGuid();

    private static ReturnOrder Create(decimal taxRate, params (decimal quantity, decimal unitPrice)[] lines) =>
        ReturnOrder.Create(
            Guid.NewGuid(), _tenantId, _branchId, "SAR", RefundMethod.Cash,
            lines.Select(l => (Guid.NewGuid(), Guid.NewGuid(), "Latte", "Large", l.quantity, l.unitPrice, ReturnReason.CustomerRequest)),
            restockItems: true,
            taxRate: taxRate).Value;

    [Fact]
    public void Create_SplitsRefundIntoNetAndVat()
    {
        ReturnOrder ret = Create(0.15m, (2m, 10m), (1m, 5m));

        ret.NetAmount.Should().Be(25m);
        ret.TaxAmount.Should().Be(3.75m);
        ret.RefundAmount.Should().Be(28.75m);
        (ret.NetAmount + ret.TaxAmount).Should().Be(ret.RefundAmount);
    }

    [Fact]
    public void Create_WithoutTax_HasNoVatPart()
    {
        ReturnOrder ret = Create(0m, (3m, 4.5m));

        ret.NetAmount.Should().Be(13.5m);
        ret.TaxAmount.Should().Be(0m);
        ret.RefundAmount.Should().Be(13.5m);
    }

    [Fact]
    public void Create_RoundsVatPartToRefund()
    {
        ReturnOrder ret = Create(0.15m, (1m, 3.3333m));

        ret.NetAmount.Should().Be(3.3333m);
        ret.TaxAmount.Should().Be(ret.RefundAmount - 3.3333m);
        ret.TaxAmount.Should().BeApproximately(0.5m, 0.0001m);
    }

    [Fact]
    public void FullReturn_OfOrderWithDiscount_CreditsWhatWasPaid()
    {
        // 100 SAR net with a 20% order discount: the customer paid 80 + 12 VAT.
        Order order = Order.Create(_tenantId, _branchId, "SAR", taxRate: 0.15m);
        OrderLine line = order.AddLine(Guid.NewGuid(), "Latte", "Large", 50m, 0m, 2m).Value;
        order.ApplyDiscount(DiscountType.Percentage, 20m);

        ReturnOrder ret = ReturnOrder.Create(
            order.Id.Value, _tenantId, _branchId, "SAR", RefundMethod.Cash,
            [(line.Id.Value, line.VariantId, line.ProductName, line.VariantName, 2m, order.EffectiveUnitNet(line), ReturnReason.CustomerRequest)],
            taxRate: order.TaxRate).Value;

        ret.NetAmount.Should().Be(80m);
        ret.TaxAmount.Should().Be(12m);
        ret.RefundAmount.Should().Be(order.TotalAmount);
    }

    [Fact]
    public void EffectiveUnitNet_TakesLineAndOrderDiscounts()
    {
        Order order = Order.Create(_tenantId, _branchId, "SAR", taxRate: 0.15m);
        Discount tenOff = Discount.Create(DiscountType.Percentage, 10m).Value;
        OrderLine discounted = order.AddLine(Guid.NewGuid(), "Latte", "Large", 40m, 0m, 1m, tenOff).Value;
        OrderLine plain = order.AddLine(Guid.NewGuid(), "Mocha", "Small", 14m, 0m, 1m).Value;
        order.ApplyDiscount(DiscountType.Fixed, 25m);

        // Lines sell for 36 + 14 = 50; the 25 SAR order discount halves each of them.
        order.EffectiveUnitNet(discounted).Should().Be(18m);
        order.EffectiveUnitNet(plain).Should().Be(7m);
    }

    [Fact]
    public void Create_WithNoLines_Fails()
    {
        var result = ReturnOrder.Create(
            Guid.NewGuid(), _tenantId, _branchId, "SAR", RefundMethod.Cash,
            [], taxRate: 0.15m);

        result.IsError.Should().BeTrue();
    }
}
