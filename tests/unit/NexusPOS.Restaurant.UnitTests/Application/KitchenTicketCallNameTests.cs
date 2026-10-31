using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Application.EventHandlers;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.UnitTests.Application;

// The name the barista calls out is kept on the ticket in its own field, so the takeaway note is never touched.
public sealed class KitchenTicketCallNameTests
{
    private static readonly Guid _latte = Guid.NewGuid();

    private static RestaurantOrder Ticket(string? callName) =>
        RestaurantOrder.CreateKitchenTicket(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 1024, null, true,
            [(_latte, "لاتيه - كبير", 1, null)], callName).Value;

    [Theory]
    [InlineData("  سارة  ", "سارة")]
    [InlineData("Ahmed", "Ahmed")]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    public void CreateKitchenTicket_StoresTheTrimmedName(string? typed, string? expected)
    {
        RestaurantOrder ticket = Ticket(typed);

        ticket.CallName.Should().Be(expected);
        ticket.Notes.Should().BeNull();
        RestaurantOrderMapper.ToResponse(ticket).CallName.Should().Be(expected);
    }

    [Fact]
    public void CreateKitchenTicket_CapsTheNameAtTheColumnLength()
    {
        Ticket(new string('ن', 60)).CallName.Should().HaveLength(RestaurantOrder.CallNameMaxLength);
    }

    [Fact]
    public void CreateKitchenTicket_WithoutAName_StillBuilds()
    {
        RestaurantOrder.CreateKitchenTicket(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 7, 3, false, [(_latte, "لاتيه", 1, null)])
            .Value.CallName.Should().BeNull();
    }

    [Fact]
    public async Task Handler_SavesTheCallNameFromTheSale()
    {
        await using RestaurantDbContext db = new(
            new DbContextOptionsBuilder<RestaurantDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
            new Mock<IPublisher>().Object);
        Guid saleId = Guid.NewGuid();

        await new KitchenTicketRequestedRestaurantHandler(db, NullLogger<KitchenTicketRequestedRestaurantHandler>.Instance)
            .Handle(new KitchenTicketRequestedDomainEvent(
                Guid.NewGuid(), Guid.NewGuid(), saleId, 1024, null, true,
                [new(_latte, "لاتيه", "كبير", 1m, null)], " نورة "), CancellationToken.None);

        RestaurantOrder saved = await db.RestaurantOrders.SingleAsync(o => o.SourceOrderId == saleId);
        saved.CallName.Should().Be("نورة");
        saved.KitchenOnly.Should().BeTrue();
    }
}
