using FluentAssertions;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Events;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class ExternalSaleOrderTests
{
    private static Order External(OrderSource source) =>
        Order.CreateExternal(Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, source, Guid.NewGuid());

    [Fact]
    public void RestaurantSale_MatchesTheRestaurantBillExactly()
    {
        // Restaurant bill: 2 × 30 + 1 × 12 = 72, discount 10, VAT 15% on 62 = 9.30, total 71.30
        Order order = External(OrderSource.Restaurant);
        order.AddLine(Guid.NewGuid(), "برجر", "", 30m, 0m, 2m);
        order.AddLine(Guid.NewGuid(), "عصير", "", 12m, 0m, 1m);
        order.ApplyDiscount(DiscountType.Fixed, 10m);

        order.SubtotalAmount.Should().Be(72m);
        order.DiscountAmount.Should().Be(10m);
        order.TaxAmount.Should().Be(9.30m);
        order.TotalAmount.Should().Be(71.30m);
    }

    [Fact]
    public void GamingSale_VatInclusiveSessionPriceIsPreserved()
    {
        // A 57.50 SAR session (VAT included) is recorded as 50.00 + 7.50 VAT.
        Order order = External(OrderSource.Gaming);
        order.AddLine(Guid.NewGuid(), "جلسة لعب", "", Math.Round(57.50m / 1.15m, 4), 0m, 1m);

        order.TotalAmount.Should().Be(57.50m);
        order.TaxAmount.Should().Be(7.50m);
    }

    [Fact]
    public void Completing_AnExternalSale_CarriesItsSource()
    {
        Order order = External(OrderSource.Gaming);
        order.AddLine(Guid.NewGuid(), "جلسة لعب", "", 50m, 0m, 1m);
        order.ClearDomainEvents();

        order.Complete(PaymentMethod.Card, order.TotalAmount).IsError.Should().BeFalse();

        order.Source.Should().Be(OrderSource.Gaming);
        order.SourceReferenceId.Should().NotBeNull();
        order.DomainEvents.OfType<OrderCompletedDomainEvent>().Single().Source.Should().Be(OrderSource.Gaming);
    }

    [Fact]
    public void RegularOrders_StayPosSales()
    {
        Order order = Order.Create(Guid.NewGuid(), Guid.NewGuid(), "SAR");
        order.Source.Should().Be(OrderSource.Pos);
        order.SourceReferenceId.Should().BeNull();
    }

    [Fact]
    public void RestaurantSale_FromVatInclusivePrices_RecordsWhatTheCustomerPaid()
    {
        // Restaurant bill with VAT-inclusive prices: 2 × 30 + 12 − 12 discount = 60.00 paid.
        // The sale is recorded net of VAT (prices ÷ 1.15) and must come back to 60.00.
        Order order = External(OrderSource.Restaurant);
        order.AddLine(Guid.NewGuid(), "برجر", "", Math.Round(30m / 1.15m, 4), 0m, 2m);
        order.AddLine(Guid.NewGuid(), "عصير", "", Math.Round(12m / 1.15m, 4), 0m, 1m);
        order.ApplyDiscount(DiscountType.Fixed, Math.Round(12m / 1.15m, 4));

        Math.Round(order.TotalAmount, 2).Should().Be(60.00m);
        Math.Round(order.TaxAmount, 2).Should().Be(7.83m);
        order.Complete(PaymentMethod.Cash, 60m).IsError.Should().BeFalse();
    }
}
