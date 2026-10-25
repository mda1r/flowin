using FluentAssertions;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Events;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class OrderLoyaltyTests
{
    private static readonly Guid _customer = Guid.NewGuid();
    private static readonly decimal _value = LoyaltyRules.Default.ValuePerPoint;

    // One line priced so the customer pays 115 SAR with 15% VAT.
    private static Order NewOrder(Guid? customerId)
    {
        Order order = Order.Create(Guid.NewGuid(), Guid.NewGuid(), "SAR", customerId, taxRate: 0.15m);
        order.AddLine(Guid.NewGuid(), "لاتيه", "كبير", 100m, 0m, 1m);
        return order;
    }

    [Fact]
    public void Redeem_HundredPoints_LowersAmountPaidByExactlyFiveRiyals()
    {
        Order order = NewOrder(_customer);

        order.RedeemLoyaltyPoints(100, _value).IsError.Should().BeFalse();

        Math.Round(order.TotalAmount, 2).Should().Be(110m);
        order.LoyaltyPointsRedeemed.Should().Be(100);
    }

    [Fact]
    public void Redeem_WithoutCustomer_IsRejected()
    {
        Order order = NewOrder(null);

        order.RedeemLoyaltyPoints(100, _value).FirstError.Should().Be(PosErrors.LoyaltyRequiresCustomer);
    }

    [Fact]
    public void Redeem_MoreThanTheBill_IsRejected()
    {
        Order order = NewOrder(_customer);

        order.RedeemLoyaltyPoints(3000, _value).FirstError.Should().Be(PosErrors.LoyaltyExceedsTotal);
    }

    [Fact]
    public void Redeem_Zero_ClearsTheDiscount()
    {
        Order order = NewOrder(_customer);
        order.RedeemLoyaltyPoints(100, _value);

        order.RedeemLoyaltyPoints(0, _value);

        order.TotalAmount.Should().Be(115m);
        order.LoyaltyDiscountAmount.Should().Be(0m);
    }

    [Fact]
    public void RemovingLines_GivesBackPointsThatNoLongerFit()
    {
        Order order = Order.Create(Guid.NewGuid(), Guid.NewGuid(), "SAR", _customer, taxRate: 0.15m);
        order.AddLine(Guid.NewGuid(), "ماء", "صغير", 10m, 0m, 1m);
        OrderLine big = order.AddLine(Guid.NewGuid(), "لاتيه", "كبير", 100m, 0m, 1m).Value;
        order.RedeemLoyaltyPoints(1000, _value);

        order.RemoveLine(big.Id);

        // The remaining bill is 11.50 SAR, worth 230 points; the other 770 stay with the customer.
        order.LoyaltyPointsRedeemed.Should().Be(230);
        order.TotalAmount.Should().Be(0m);
    }

    [Fact]
    public void Complete_CarriesCustomerAndRedeemedPoints()
    {
        Order order = NewOrder(_customer);
        order.RedeemLoyaltyPoints(100, _value);
        order.ClearDomainEvents();

        order.Complete(PaymentMethod.Cash, order.TotalAmount).IsError.Should().BeFalse();

        OrderCompletedDomainEvent evt = order.DomainEvents.OfType<OrderCompletedDomainEvent>().Single();
        evt.CustomerId.Should().Be(_customer);
        evt.LoyaltyPointsRedeemed.Should().Be(100);
        LoyaltyRules.Default.PointsEarned(evt.Total).Should().Be(110);
    }
}
