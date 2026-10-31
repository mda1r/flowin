using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.POS.Infrastructure.Persistence.Repositories;

namespace NexusPOS.POS.UnitTests.Infrastructure;

// Reports ask for a day's orders; a sale synced late from an offline till belongs to the day it was made.
public sealed class OrderRepositoryDateTests
{
    private static readonly Guid _branchId = Guid.NewGuid();

    private static PosDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<PosDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
            new Mock<IPublisher>().Object);

    private static Order Sale(long number, DateTime? completedAt = null)
    {
        Order order = Order.Create(Guid.NewGuid(), _branchId, "SAR", taxRate: 0.15m);
        order.AddLine(Guid.NewGuid(), "لاتيه", "", 20m, 0m, 1m);
        order.AssignNumber(number);
        order.Complete(PaymentMethod.Cash, 100m, completedAt: completedAt);
        return order;
    }

    [Fact]
    public async Task ASaleMadeYesterdayButSyncedToday_CountsYesterday()
    {
        await using PosDbContext db = CreateDb();
        DateTime today = DateTime.UtcNow.Date;
        DateTime yesterday = today.AddDays(-1);
        db.Orders.AddRange(Sale(1, completedAt: yesterday.AddHours(20)), Sale(2));
        await db.SaveChangesAsync();
        OrderRepository repo = new(db);

        IReadOnlyList<Order> dayOne = await repo.FindByBranchAsync(
            _branchId, OrderStatus.Completed, yesterday, today.AddTicks(-1), 1, 50);
        IReadOnlyList<Order> dayTwo = await repo.FindByBranchAsync(
            _branchId, OrderStatus.Completed, today, today.AddDays(1).AddTicks(-1), 1, 50);

        dayOne.Select(o => o.Number).Should().Equal(1L);
        dayTwo.Select(o => o.Number).Should().Equal(2L);
    }

    [Fact]
    public async Task Orders_AreListedNewestSaleFirst()
    {
        await using PosDbContext db = CreateDb();
        DateTime now = DateTime.UtcNow;
        db.Orders.AddRange(Sale(1, completedAt: now.AddHours(-3)), Sale(2), Sale(3, completedAt: now.AddHours(-1)));
        await db.SaveChangesAsync();

        IReadOnlyList<Order> orders = await new OrderRepository(db).FindByBranchAsync(_branchId, null, null, null, 1, 50);

        orders.Select(o => o.Number).Should().Equal(2L, 3L, 1L);
    }
}
