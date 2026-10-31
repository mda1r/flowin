using ErrorOr;
using FluentAssertions;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Domain.Events;

namespace NexusPOS.Restaurant.UnitTests.Domain;

public sealed class RestaurantOrderRoundsTests
{
    private static readonly Guid _burger = Guid.NewGuid();
    private static readonly Guid _juice = Guid.NewGuid();
    private static readonly HashSet<Guid> _menu = [_burger, _juice];

    private static RestaurantOrder NewOrder(decimal discount = 0m, bool kitchenCopy = false)
    {
        ErrorOr<RestaurantOrder> result = kitchenCopy
            ? RestaurantOrder.CreateKitchenTicket(
                Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 7, 4, false, [(_burger, "برجر", 2, null), (_juice, "عصير", 1, null)])
            : RestaurantOrder.Create(
                Guid.NewGuid(), Guid.NewGuid(), 4,
                [(_burger, "برجر", 2, 30m, null), (_juice, "عصير", 1, 12m, null)],
                null, null, discount);
        RestaurantOrder order = result.Value;
        order.ClearDomainEvents();
        return order;
    }

    // ── Adding a round ─────────────────────────────────────────────────────

    [Fact]
    public void AddItems_AddsTheRoundToTheSameBill()
    {
        RestaurantOrder order = NewOrder();

        ErrorOr<IReadOnlyList<RestaurantOrderItem>> added = order.AddItems([(_juice, "عصير", 2, 12m, "بارد")]);

        added.IsError.Should().BeFalse();
        added.Value.Should().ContainSingle().Which.Notes.Should().Be("بارد");
        order.Items.Should().HaveCount(3);
        order.SubTotal.Should().Be(96m);
        order.Total.Should().Be(96m);
        Math.Round(order.TaxAmount, 2).Should().Be(12.52m);
    }

    [Fact]
    public void AddItems_KeepsTheFixedDiscount()
    {
        RestaurantOrder order = NewOrder(discount: 12m);

        order.AddItems([(_juice, "عصير", 1, 12m, null)]);

        order.DiscountAmount.Should().Be(12m);
        order.Total.Should().Be(72m);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void AddItems_ToAReadyOrServedOrder_SendsItBackToTheKitchen(bool served)
    {
        RestaurantOrder order = NewOrder();
        order.SendToKitchen();
        order.MarkReady();
        if (served)
        {
            order.Serve();
        }
        order.ClearDomainEvents();

        order.AddItems([(_juice, "عصير", 1, 12m, null)]);

        order.Status.Should().Be(RestaurantOrderStatus.InKitchen);
        order.DomainEvents.OfType<OrderSentToKitchenDomainEvent>().Should().ContainSingle();
    }

    [Fact]
    public void AddItems_ToAPendingOrder_LeavesItPending()
    {
        RestaurantOrder order = NewOrder();

        order.AddItems([(_juice, "عصير", 1, 12m, null)]);

        order.Status.Should().Be(RestaurantOrderStatus.Pending);
    }

    [Fact]
    public void AddItems_ToAPaidOrder_IsRefused()
    {
        RestaurantOrder order = NewOrder();
        order.Pay("Cash", 1000m, _menu);

        order.AddItems([(_juice, "عصير", 1, 12m, null)]).FirstError.Should().Be(RestaurantErrors.OrderNotModifiable);
        order.Total.Should().Be(72m);
    }

    [Fact]
    public void AddItems_ToAKitchenCopy_IsRefused()
    {
        RestaurantOrder order = NewOrder(kitchenCopy: true);

        order.AddItems([(_juice, "عصير", 1, 12m, null)]).FirstError.Should().Be(RestaurantErrors.OrderNotModifiable);
    }

    [Fact]
    public void AddItems_WithNothing_IsRefused()
    {
        RestaurantOrder order = NewOrder();

        order.AddItems([]).FirstError.Should().Be(RestaurantErrors.EmptyOrder);
    }

    // ── Removing a line ────────────────────────────────────────────────────

    [Fact]
    public void RemoveItem_TakesTheLineOffTheBill()
    {
        RestaurantOrder order = NewOrder();
        RestaurantOrderItem juice = order.Items.Single(i => i.MenuItemId == _juice);

        ErrorOr<RestaurantOrderItem> removed = order.RemoveItem(juice.Id);

        removed.Value.Should().BeSameAs(juice);
        order.Items.Should().ContainSingle().Which.MenuItemId.Should().Be(_burger);
        order.Total.Should().Be(60m);
    }

    [Fact]
    public void RemoveItem_DiscountNeverExceedsWhatIsLeft()
    {
        RestaurantOrder order = NewOrder(discount: 50m);

        order.RemoveItem(order.Items.Single(i => i.MenuItemId == _burger).Id);

        order.DiscountAmount.Should().Be(12m);
        order.Total.Should().Be(0m);
    }

    [Fact]
    public void RemoveItem_ThatIsReady_IsRefused()
    {
        RestaurantOrder order = NewOrder();
        order.SendToKitchen();
        RestaurantOrderItem juice = order.Items.Single(i => i.MenuItemId == _juice);
        order.MarkItemReady(juice.Id);

        order.RemoveItem(juice.Id).FirstError.Should().Be(RestaurantErrors.OrderItemAlreadyReady);
        order.Items.Should().HaveCount(2);
    }

    [Fact]
    public void RemoveItem_TheLastLine_IsRefused()
    {
        RestaurantOrder order = NewOrder();
        order.RemoveItem(order.Items[0].Id);

        order.RemoveItem(order.Items[0].Id).FirstError.Should().Be(RestaurantErrors.LastOrderItem);
    }

    [Fact]
    public void RemoveItem_FromAPaidOrder_IsRefused()
    {
        RestaurantOrder order = NewOrder();
        order.Pay("Cash", 1000m, _menu);

        order.RemoveItem(order.Items[0].Id).FirstError.Should().Be(RestaurantErrors.OrderNotModifiable);
    }

    [Fact]
    public void RemoveItem_Unknown_IsNotFound()
    {
        RestaurantOrder order = NewOrder();

        order.RemoveItem(new(Guid.NewGuid())).FirstError.Should().Be(RestaurantErrors.OrderItemNotFound);
    }

    // ── Cancelling ─────────────────────────────────────────────────────────

    [Fact]
    public void Cancel_RecordsWhyWhoAndWhen()
    {
        RestaurantOrder order = NewOrder();
        Guid manager = Guid.NewGuid();

        order.Cancel("  طلب خاطئ ", manager).IsError.Should().BeFalse();

        order.Status.Should().Be(RestaurantOrderStatus.Cancelled);
        order.CancelReason.Should().Be("طلب خاطئ");
        order.CancelledBy.Should().Be(manager);
        order.CancelledAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Cancel_WithoutAReason_IsRefused(string reason)
    {
        RestaurantOrder order = NewOrder();

        order.Cancel(reason, null).FirstError.Should().Be(RestaurantErrors.CancelReasonRequired);
        order.Status.Should().Be(RestaurantOrderStatus.Pending);
    }

    [Fact]
    public void Cancel_APaidOrder_IsRefused()
    {
        RestaurantOrder order = NewOrder();
        order.Pay("Cash", 1000m, _menu);

        order.Cancel("خطأ", null).FirstError.Should().Be(RestaurantErrors.OrderAlreadyPaid);
    }

    [Fact]
    public void DiscountCode_CancelGivesTheUseBack_NeverBelowZero()
    {
        DiscountCode code = DiscountCode.Create(
            Guid.NewGuid(), "SAVE10", DiscountCodeType.Percentage, 10m, 0m, 5, DateTime.UtcNow.AddDays(1)).Value;
        code.IncrementUsage();

        code.DecrementUsage();
        code.DecrementUsage();

        code.UsedCount.Should().Be(0);
    }
}
