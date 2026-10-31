using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NexusPOS.Restaurant.Application.EventHandlers;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.UnitTests.Application;

// A cancelled or refunded cafe sale leaves the barista board, unless its drinks were already handed over.
public sealed class KitchenTicketVoidTests
{
    private static readonly Guid _latte = Guid.NewGuid();

    private static RestaurantOrder Ticket(Guid tenantId, Guid saleId, RestaurantOrderStatus status)
    {
        RestaurantOrder ticket = RestaurantOrder.CreateKitchenTicket(
            tenantId, Guid.NewGuid(), saleId, 1024, null, true, [(_latte, "لاتيه - كبير", 1, null)]).Value;
        if (status >= RestaurantOrderStatus.InKitchen)
        {
            ticket.SendToKitchen().IsError.Should().BeFalse();
        }

        if (status >= RestaurantOrderStatus.Ready)
        {
            ticket.MarkReady().IsError.Should().BeFalse();
        }

        if (status == RestaurantOrderStatus.Served)
        {
            ticket.Serve().IsError.Should().BeFalse();
        }

        ticket.Status.Should().Be(status);
        return ticket;
    }

    private static RestaurantDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<RestaurantDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options,
            new Mock<IPublisher>().Object);

    private static Task HandleAsync(RestaurantDbContext db, Guid tenantId, Guid saleId, string reason) =>
        new KitchenTicketVoidRestaurantHandler(db, NullLogger<KitchenTicketVoidRestaurantHandler>.Instance)
            .Handle(new KitchenTicketVoidRequestedDomainEvent(tenantId, Guid.NewGuid(), saleId, reason), CancellationToken.None);

    [Theory]
    [InlineData(RestaurantOrderStatus.Pending)]
    [InlineData(RestaurantOrderStatus.InKitchen)]
    [InlineData(RestaurantOrderStatus.Ready)]
    public void Void_TicketNotYetHandedOver_IsCancelledWithTheReason(RestaurantOrderStatus status)
    {
        RestaurantOrder ticket = Ticket(Guid.NewGuid(), Guid.NewGuid(), status);

        KitchenTicketVoidRestaurantHandler.Void(ticket, KitchenTicketVoidRequestedDomainEvent.ReturnedReason).Should().BeTrue();

        ticket.Status.Should().Be(RestaurantOrderStatus.Cancelled);
        ticket.CancelReason.Should().Be("استرجاع البيع");
    }

    [Fact]
    public void Void_ServedTicket_IsLeftAlone()
    {
        RestaurantOrder ticket = Ticket(Guid.NewGuid(), Guid.NewGuid(), RestaurantOrderStatus.Served);

        KitchenTicketVoidRestaurantHandler.Void(ticket, KitchenTicketVoidRequestedDomainEvent.ReturnedReason).Should().BeFalse();

        ticket.Status.Should().Be(RestaurantOrderStatus.Served);
        ticket.CancelReason.Should().BeNull();
    }

    [Fact]
    public void Void_RestaurantOrder_IsNeverTouched()
    {
        RestaurantOrder order = RestaurantOrder.Create(
            Guid.NewGuid(), Guid.NewGuid(), 2, [(_latte, "لاتيه", 1, 20m, null)], null, null, 0m).Value;

        KitchenTicketVoidRestaurantHandler.Void(order, KitchenTicketVoidRequestedDomainEvent.CancelledReason).Should().BeFalse();

        order.Status.Should().Be(RestaurantOrderStatus.Pending);
    }

    [Fact]
    public void Void_WithoutReason_FallsBackToCancelledSale()
    {
        RestaurantOrder ticket = Ticket(Guid.NewGuid(), Guid.NewGuid(), RestaurantOrderStatus.Pending);

        KitchenTicketVoidRestaurantHandler.Void(ticket, " ").Should().BeTrue();

        ticket.CancelReason.Should().Be("إلغاء البيع");
    }

    [Fact]
    public async Task Handle_CancelsTheSalesTicket_AndLeavesOtherTenantsAlone()
    {
        await using RestaurantDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();
        Guid saleId = Guid.NewGuid();
        db.RestaurantOrders.Add(Ticket(tenantId, saleId, RestaurantOrderStatus.InKitchen));
        // Another store's ticket that happens to carry the same sale id.
        db.RestaurantOrders.Add(Ticket(Guid.NewGuid(), saleId, RestaurantOrderStatus.InKitchen));
        await db.SaveChangesAsync();

        await HandleAsync(db, tenantId, saleId, KitchenTicketVoidRequestedDomainEvent.CancelledReason);

        List<RestaurantOrder> tickets = await db.RestaurantOrders.AsNoTracking().ToListAsync();
        tickets.Single(t => t.TenantId == tenantId).Status.Should().Be(RestaurantOrderStatus.Cancelled);
        tickets.Single(t => t.TenantId != tenantId).Status.Should().Be(RestaurantOrderStatus.InKitchen);
    }

    [Fact]
    public async Task Handle_ServedTicket_StaysServed()
    {
        await using RestaurantDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();
        Guid saleId = Guid.NewGuid();
        db.RestaurantOrders.Add(Ticket(tenantId, saleId, RestaurantOrderStatus.Served));
        await db.SaveChangesAsync();

        await HandleAsync(db, tenantId, saleId, KitchenTicketVoidRequestedDomainEvent.ReturnedReason);

        (await db.RestaurantOrders.AsNoTracking().SingleAsync()).Status.Should().Be(RestaurantOrderStatus.Served);
    }

    [Fact]
    public async Task Handle_SaleWithNoTicket_DoesNothing()
    {
        await using RestaurantDbContext db = CreateDb();

        Func<Task> act = () => HandleAsync(db, Guid.NewGuid(), Guid.NewGuid(), KitchenTicketVoidRequestedDomainEvent.ReturnedReason);

        await act.Should().NotThrowAsync();
    }
}
