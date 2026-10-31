using FluentAssertions;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;

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
    public void Create_WithNoLines_Fails()
    {
        var result = ReturnOrder.Create(
            Guid.NewGuid(), _tenantId, _branchId, "SAR", RefundMethod.Cash,
            [], taxRate: 0.15m);

        result.IsError.Should().BeTrue();
    }
}
