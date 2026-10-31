using ErrorOr;
using FluentAssertions;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;

namespace NexusPOS.Restaurant.UnitTests.Domain;

public sealed class RestaurantOrderQueriesTests
{
    private static readonly Guid _branch = Guid.NewGuid();
    private static readonly DateTime _since = DateTime.UtcNow - RestaurantOrderQueries.LookBack;

    // A ticket number makes it a cafe kitchen ticket (already paid at the till); without one it is a table order.
    private static RestaurantOrder NewOrder(long? ticketNumber = null, Guid? branchId = null)
    {
        ErrorOr<RestaurantOrder> result = ticketNumber is null
            ? RestaurantOrder.Create(
                Guid.NewGuid(), branchId ?? _branch, 3,
                [(Guid.NewGuid(), "لاتيه - كبير", 1, 18m, null)],
                null, null, 0m)
            : RestaurantOrder.CreateKitchenTicket(
                Guid.NewGuid(), branchId ?? _branch, Guid.NewGuid(), ticketNumber, 3, false,
                [(Guid.NewGuid(), "لاتيه - كبير", 1, null)]);
        return result.Value;
    }

    private static RestaurantOrder Advance(RestaurantOrder order, RestaurantOrderStatus target)
    {
        if (target >= RestaurantOrderStatus.InKitchen) { order.SendToKitchen(); }
        if (target >= RestaurantOrderStatus.Ready) { order.MarkReady(); }
        if (target >= RestaurantOrderStatus.Served) { order.Serve(); }
        if (target == RestaurantOrderStatus.Cancelled) { order.Cancel("اختبار", null); }
        return order;
    }

    private static bool OnKitchen(RestaurantOrder order) =>
        RestaurantOrderQueries.Kitchen(_branch, _since).Compile()(order);

    private static bool OnFloor(RestaurantOrder order) =>
        RestaurantOrderQueries.Floor(_branch, _since).Compile()(order);

    [Theory]
    [InlineData(RestaurantOrderStatus.Pending, true)]
    [InlineData(RestaurantOrderStatus.InKitchen, true)]
    [InlineData(RestaurantOrderStatus.Ready, true)]
    [InlineData(RestaurantOrderStatus.Served, false)]
    [InlineData(RestaurantOrderStatus.Cancelled, false)]
    public void Kitchen_ShowsOnlyOrdersStillToMakeOrHandOver(RestaurantOrderStatus status, bool expected)
    {
        OnKitchen(Advance(NewOrder(23), status)).Should().Be(expected);
    }

    [Fact]
    public void Kitchen_DismissedCafeTicket_LeavesTheScreen()
    {
        RestaurantOrder ticket = Advance(NewOrder(23), RestaurantOrderStatus.Ready);
        OnKitchen(ticket).Should().BeTrue();

        ticket.Serve();

        OnKitchen(ticket).Should().BeFalse();
        OnFloor(ticket).Should().BeFalse();
    }

    [Fact]
    public void Kitchen_IgnoresOtherBranchesAndOrdersOlderThanTheLookBack()
    {
        OnKitchen(NewOrder(23, Guid.NewGuid())).Should().BeFalse();

        RestaurantOrderQueries.Kitchen(_branch, DateTime.UtcNow.AddMinutes(1)).Compile()(NewOrder(23))
            .Should().BeFalse();
    }

    [Fact]
    public void Floor_KeepsServedTableOrdersUntilPaid()
    {
        RestaurantOrder table = Advance(NewOrder(), RestaurantOrderStatus.Served);

        OnFloor(table).Should().BeTrue();

        table.Pay("Cash", 1000m, new HashSet<Guid>());
        OnFloor(table).Should().BeFalse();
    }

    [Fact]
    public void Floor_NeverShowsCafeTickets()
    {
        OnFloor(NewOrder(23)).Should().BeFalse();
        OnFloor(NewOrder()).Should().BeTrue();
    }
}
