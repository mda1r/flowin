using ErrorOr;
using FluentAssertions;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;

namespace NexusPOS.Restaurant.UnitTests.Domain;

public sealed class KitchenTicketTests
{
    private static readonly Guid _latte = Guid.NewGuid();
    private static readonly Guid _sale = Guid.NewGuid();

    private static ErrorOr<RestaurantOrder> Ticket(int? table = 5, bool takeaway = false, int quantity = 2) =>
        RestaurantOrder.CreateKitchenTicket(
            Guid.NewGuid(), Guid.NewGuid(), _sale, 1024, table, takeaway,
            [(_latte, "لاتيه - كبير", quantity, "حليب شوفان")]);

    [Fact]
    public void KitchenTicket_IsKitchenOnlyWithNoMoney()
    {
        RestaurantOrder ticket = Ticket().Value;

        ticket.KitchenOnly.Should().BeTrue();
        ticket.SourceOrderId.Should().Be(_sale);
        ticket.TicketNumber.Should().Be(1024);
        ticket.Status.Should().Be(RestaurantOrderStatus.Pending);
        ticket.TableNumber.Should().Be(5);
        ticket.Total.Should().Be(0m);
        ticket.Items.Should().ContainSingle().Which.Notes.Should().Be("حليب شوفان");
        ticket.Items[0].UnitPrice.Should().Be(0m);
    }

    [Fact]
    public void Takeaway_UsesTheTakeawayTable_AndNoTableMeansZero()
    {
        Ticket(table: 7, takeaway: true).Value.TableNumber.Should().Be(RestaurantOrder.TakeawayTable);
        Ticket(table: null).Value.TableNumber.Should().Be(0);
    }

    [Fact]
    public void KitchenTicket_WithNothingToMake_IsRejected()
    {
        Ticket(quantity: 0).FirstError.Should().Be(RestaurantErrors.EmptyOrder);
    }

    [Fact]
    public void KitchenTicket_CanNeverBePaid()
    {
        RestaurantOrder ticket = Ticket().Value;

        ticket.Pay("Cash", 100m, new HashSet<Guid>()).FirstError.Should().Be(RestaurantErrors.KitchenTicketNotPayable);
        ticket.Status.Should().Be(RestaurantOrderStatus.Pending);
    }

    [Fact]
    public void KitchenTicket_MovesThroughTheKitchenAndIsServed()
    {
        RestaurantOrder ticket = Ticket().Value;

        ticket.SendToKitchen().IsError.Should().BeFalse();
        ticket.MarkReady().IsError.Should().BeFalse();
        ticket.Serve().IsError.Should().BeFalse();
        ticket.Status.Should().Be(RestaurantOrderStatus.Served);
    }
}
