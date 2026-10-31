using ErrorOr;
using FluentAssertions;
using MediatR;
using Moq;
using NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;
using NexusPOS.Restaurant.Application.Commands.PayTable;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.UnitTests.Application;

public sealed class RestaurantPaymentTests
{
    private static readonly Guid _burger = Guid.NewGuid();

    private static RestaurantOrder NewOrder(bool kitchenCopy = false) =>
        RestaurantOrder.Create(
            Guid.NewGuid(), Guid.NewGuid(), 2,
            [(_burger, "برجر", 2, 34.5m, null)],
            null, null, 0m, kitchenCopy).Value;

    // ── Splitting one payment across a table's orders ──────────────────────

    [Fact]
    public void SplitTender_EachOrderGetsItsTotal_ChangeOnTheLast()
    {
        RestaurantPayment.SplitTender([40m, 25.5m], 100m).Should().Equal(40m, 60m);
    }

    [Fact]
    public void SplitTender_ExactAmount_PaysEachOrderItsTotal()
    {
        RestaurantPayment.SplitTender([40m, 25.5m, 10m], 75.5m).Should().Equal(40m, 25.5m, 10m);
    }

    // ── Recording the sale ─────────────────────────────────────────────────

    [Fact]
    public async Task PayAsync_PublishesOneSaleWithNetPrices()
    {
        RestaurantOrder order = NewOrder();
        Mock<IPublisher> publisher = new();

        ErrorOr<Success> result = await RestaurantPayment.PayAsync(
            order, "Cash", 100m, new HashSet<Guid> { _burger }, publisher.Object, CancellationToken.None);

        result.IsError.Should().BeFalse();
        order.Status.Should().Be(RestaurantOrderStatus.Paid);
        publisher.Verify(p => p.Publish(
            It.Is<ExternalSaleCompletedDomainEvent>(e =>
                e.SourceReferenceId == order.Id.Value
                && e.Lines.Count == 1
                && e.Lines[0].UnitPrice == 30m
                && e.AmountTendered == 100m),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PayAsync_KitchenCopy_RecordsNoSaleAndUsesNoStock()
    {
        RestaurantOrder order = NewOrder(kitchenCopy: true);
        Mock<IPublisher> publisher = new();

        ErrorOr<Success> result = await RestaurantPayment.PayAsync(
            order, "Cash", 100m, new HashSet<Guid> { _burger }, publisher.Object, CancellationToken.None);

        result.IsError.Should().BeFalse();
        publisher.Verify(p => p.Publish(It.IsAny<ExternalSaleCompletedDomainEvent>(), It.IsAny<CancellationToken>()), Times.Never);
        order.DomainEvents.OfType<RecipeItemsSoldDomainEvent>().Should().BeEmpty();
    }

    [Fact]
    public async Task PayAsync_ShortPayment_PublishesNothing()
    {
        RestaurantOrder order = NewOrder();
        Mock<IPublisher> publisher = new();

        ErrorOr<Success> result = await RestaurantPayment.PayAsync(
            order, "Cash", 10m, new HashSet<Guid> { _burger }, publisher.Object, CancellationToken.None);

        result.FirstError.Should().Be(RestaurantErrors.InsufficientPayment);
        publisher.Verify(p => p.Publish(It.IsAny<ExternalSaleCompletedDomainEvent>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ── Pricing from the menu ──────────────────────────────────────────────

    private static MenuItem Menu(string name, decimal price, bool available = true)
    {
        MenuItem item = MenuItem.Create(Guid.NewGuid(), Guid.NewGuid(), MenuCategory.Mains, name, "", price, "SAR", 0).Value;
        item.SetAvailability(available);
        return item;
    }

    [Fact]
    public void Resolve_UsesTheMenuNameAndPrice()
    {
        MenuItem burger = Menu("برجر", 30m);

        var lines = MenuOrderLines.Resolve(
            [new OrderItemInput(burger.Id.Value, 2, "بدون بصل")],
            new Dictionary<Guid, MenuItem> { [burger.Id.Value] = burger });

        lines.Value.Should().ContainSingle().Which.Should().Be((burger.Id.Value, "برجر", 2, 30m, "بدون بصل"));
    }

    [Fact]
    public void Resolve_UnknownItem_IsNotFound()
    {
        var lines = MenuOrderLines.Resolve([new OrderItemInput(Guid.NewGuid(), 1, null)], new Dictionary<Guid, MenuItem>());

        lines.FirstError.Should().Be(RestaurantErrors.MenuItemNotFound);
    }

    [Fact]
    public void Resolve_UnavailableItem_IsRefused()
    {
        MenuItem soup = Menu("شوربة", 15m, available: false);

        var lines = MenuOrderLines.Resolve(
            [new OrderItemInput(soup.Id.Value, 1, null)],
            new Dictionary<Guid, MenuItem> { [soup.Id.Value] = soup });

        lines.FirstError.Should().Be(RestaurantErrors.MenuItemUnavailable);
    }

    // ── Validation ─────────────────────────────────────────────────────────

    [Fact]
    public void CreateValidator_RejectsAnUnknownPaymentMethod()
    {
        CreateRestaurantOrderCommand command = new(
            Guid.NewGuid(), 99, [new OrderItemInput(Guid.NewGuid(), 1, null)], null, null,
            SendToKitchen: true, Payment: new OrderPaymentInput("Voucher", 50m));

        new CreateRestaurantOrderCommandValidator().Validate(command).IsValid.Should().BeFalse();
    }

    [Fact]
    public void CreateValidator_AcceptsAPaidQuickOrder()
    {
        CreateRestaurantOrderCommand command = new(
            Guid.NewGuid(), 99, [new OrderItemInput(Guid.NewGuid(), 1, null)], null, null,
            SendToKitchen: true, Payment: new OrderPaymentInput("Card", 50m));

        new CreateRestaurantOrderCommandValidator().Validate(command).IsValid.Should().BeTrue();
    }

    [Fact]
    public void PayTableValidator_NeedsTheOrdersOnTheBill()
    {
        PayTableCommand command = new(Guid.NewGuid(), 3, [], "Cash", 50m);

        new PayTableCommandValidator().Validate(command).IsValid.Should().BeFalse();
    }
}
