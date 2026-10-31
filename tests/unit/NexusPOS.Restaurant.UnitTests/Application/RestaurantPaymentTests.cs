using FluentAssertions;
using NexusPOS.Restaurant.Application.Commands.CreateKitchenCopy;
using NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;
using NexusPOS.Restaurant.Application.Commands.PayTable;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.SharedKernel.Application.Services;
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
    public void Pay_ReturnsOneSaleWithNetPrices()
    {
        RestaurantOrder order = NewOrder();

        var sales = RestaurantPayment.Pay(order, "Cash", 100m, new HashSet<Guid> { _burger });

        sales.IsError.Should().BeFalse();
        order.Status.Should().Be(RestaurantOrderStatus.Paid);
        ExternalSaleCompletedDomainEvent sale = sales.Value.Should().ContainSingle().Subject;
        sale.SourceReferenceId.Should().Be(order.Id.Value);
        sale.Lines.Should().ContainSingle().Which.UnitPrice.Should().Be(30m);
        sale.AmountTendered.Should().Be(100m);
    }

    [Fact]
    public void Pay_KitchenCopy_IsRefused_ItWasPaidAtTheCafeTill()
    {
        RestaurantOrder order = NewOrder(kitchenCopy: true);

        var sales = RestaurantPayment.Pay(order, "Cash", 100m, new HashSet<Guid> { _burger });

        sales.FirstError.Should().Be(RestaurantErrors.KitchenCopyNotPayable);
        order.Status.Should().NotBe(RestaurantOrderStatus.Paid);
        order.DomainEvents.OfType<RecipeItemsSoldDomainEvent>().Should().BeEmpty();
    }

    [Fact]
    public void Pay_ShortPayment_RecordsNothing()
    {
        RestaurantOrder order = NewOrder();

        var sales = RestaurantPayment.Pay(order, "Cash", 10m, new HashSet<Guid> { _burger });

        sales.FirstError.Should().Be(RestaurantErrors.InsufficientPayment);
        order.Status.Should().NotBe(RestaurantOrderStatus.Paid);
    }

    [Fact]
    public void Pay_NoMenuItems_RecordsNoSale()
    {
        RestaurantOrder order = NewOrder();

        var sales = RestaurantPayment.Pay(order, "Cash", 100m, new HashSet<Guid>());

        sales.IsError.Should().BeFalse();
        sales.Value.Should().BeEmpty();
    }

    // ── Kitchen copies of cafe sales ───────────────────────────────────────

    [Fact]
    public void KitchenCopyLines_ComeFromTheSale_WithTheTillsNotes()
    {
        Guid latte = Guid.NewGuid();
        Guid cookie = Guid.NewGuid();

        var lines = CreateKitchenCopyCommandHandler.Lines(
            [new PosSaleLine(latte, "لاتيه", 2m, 18m), new PosSaleLine(cookie, "كوكيز", 1m, 9.5m)],
            [new KitchenCopyNoteInput(latte, " بدون سكر "), new KitchenCopyNoteInput(Guid.NewGuid(), "ليس في الفاتورة")]).ToList();

        lines.Should().Equal(
            (latte, "لاتيه", 2, 18m, "بدون سكر"),
            (cookie, "كوكيز", 1, 9.5m, (string?)null));
    }

    [Fact]
    public void CreateValidator_RejectsAnEmptyClientOrderId()
    {
        CreateRestaurantOrderCommand command = new(
            Guid.NewGuid(), 99, [new OrderItemInput(Guid.NewGuid(), 1, null)], null, null, OrderId: Guid.Empty);

        new CreateRestaurantOrderCommandValidator().Validate(command).IsValid.Should().BeFalse();
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
