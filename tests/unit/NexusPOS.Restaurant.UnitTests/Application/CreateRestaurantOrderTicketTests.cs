using ErrorOr;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using Npgsql;

namespace NexusPOS.Restaurant.UnitTests.Application;

public sealed class CreateRestaurantOrderTicketTests
{
    private static readonly Guid _branch = Guid.NewGuid();

    private static CreateRestaurantOrderCommand Command(string? ticketNumber) => new(
        Guid.NewGuid(), _branch, 99,
        [new OrderItemInput(Guid.NewGuid(), "لاتيه - كبير", 1, 18m, null)],
        null, null, ticketNumber);

    [Fact]
    public async Task Handle_TicketAlreadySent_ReturnsItWithoutAddingAnother()
    {
        RestaurantOrder sent = RestaurantOrder.Create(
            Guid.NewGuid(), _branch, 99, [(Guid.NewGuid(), "لاتيه - كبير", 1, 18m, null)],
            null, null, 0m, "23").Value;
        Mock<IRestaurantOrderRepository> orders = new();
        orders
            .Setup(r => r.FindByTicketAsync(_branch, "23", It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(sent);
        CreateRestaurantOrderCommandHandler handler = new(orders.Object, Mock.Of<IDiscountCodeRepository>(), null!);

        ErrorOr<RestaurantOrderResponse> result = await handler.Handle(Command(" 23 "), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Id.Should().Be(sent.Id.Value);
        result.Value.TicketNumber.Should().Be("23");
        orders.Verify(r => r.Add(It.IsAny<RestaurantOrder>()), Times.Never);
    }

    [Theory]
    [InlineData("23505", "ux_restaurant_orders_branch_ticket", true)]
    [InlineData("23505", "pk_restaurant_orders", false)]
    [InlineData("23503", "ux_restaurant_orders_branch_ticket", false)]
    public void IsTicketClash_OnlyMatchesTheTicketUniqueIndex(string sqlState, string constraint, bool expected)
    {
        PostgresException pg = new("duplicate key", "ERROR", "ERROR", sqlState, constraintName: constraint);

        CreateRestaurantOrderCommandHandler.IsTicketClash(new DbUpdateException("save failed", pg)).Should().Be(expected);
        CreateRestaurantOrderCommandHandler.IsTicketClash(new DbUpdateException("save failed")).Should().BeFalse();
    }

    [Fact]
    public void Validator_RejectsATicketNumberLongerThanTheColumn()
    {
        CreateRestaurantOrderCommandValidator validator = new();

        validator.Validate(Command(new string('9', 17))).IsValid.Should().BeFalse();
        validator.Validate(Command("A1B2C3")).IsValid.Should().BeTrue();
    }
}
