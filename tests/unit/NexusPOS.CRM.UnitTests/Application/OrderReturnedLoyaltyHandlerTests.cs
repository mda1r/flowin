using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NexusPOS.CRM.Application.EventHandlers;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.POS.Domain.Events;

namespace NexusPOS.CRM.UnitTests.Application;

// Which figures a refund reverses: the sale's own ledger rows, or the programme for sales from before the ledger.
public sealed class OrderReturnedLoyaltyHandlerTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly DateTime _ledgerStart = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task LedgerEraSaleThatEarnedNothing_TakesNothingBack()
    {
        // Sold while the programme was off, so no rows were written; the programme is on (the default) at refund time.
        await using CrmDbContext db = CreateDb();
        Customer customer = await SeedCustomerAsync(db, points: 500, ledgerStart: _ledgerStart);
        Guid orderId = Guid.NewGuid();

        await HandleAsync(db, customer, orderId, completedAt: _ledgerStart.AddDays(3), share: 1m, refunded: 115m, pointsRedeemed: 0);

        (await PointsOf(db, customer)).Should().Be(500);
        (await db.LoyaltyTransactions.CountAsync(t => t.Kind == LoyaltyTransactionKind.Reverse)).Should().Be(0);
    }

    [Fact]
    public async Task LedgerEraSaleWhoseRedeemFailed_GivesNothingBack()
    {
        // The sale earned 100 points, but its 200 redeemed points were never deducted (no Redeem row).
        await using CrmDbContext db = CreateDb();
        Customer customer = await SeedCustomerAsync(db, points: 300, ledgerStart: _ledgerStart);
        Guid orderId = Guid.NewGuid();
        db.LoyaltyTransactions.Add(LoyaltyTransaction.Create(_tenantId, customer.Id.Value, 100, LoyaltyTransactionKind.Earn, orderId));
        await db.SaveChangesAsync();

        await HandleAsync(db, customer, orderId, completedAt: _ledgerStart.AddDays(3), share: 1m, refunded: 100m, pointsRedeemed: 200);

        (await PointsOf(db, customer)).Should().Be(200);
    }

    [Fact]
    public async Task NoLedgerStartRecorded_NeverFallsBackToTheProgramme()
    {
        await using CrmDbContext db = CreateDb();
        Customer customer = await SeedCustomerAsync(db, points: 500, ledgerStart: null);

        await HandleAsync(db, customer, Guid.NewGuid(), completedAt: _ledgerStart.AddYears(-1), share: 1m, refunded: 115m, pointsRedeemed: 0);

        (await PointsOf(db, customer)).Should().Be(500);
    }

    [Fact]
    public async Task PreLedgerSale_FallsBackToTheProgramme()
    {
        await using CrmDbContext db = CreateDb();
        Customer customer = await SeedCustomerAsync(db, points: 500, ledgerStart: _ledgerStart);

        await HandleAsync(db, customer, Guid.NewGuid(), completedAt: _ledgerStart.AddDays(-3), share: 1m, refunded: 115m, pointsRedeemed: 0);

        (await PointsOf(db, customer)).Should().Be(385);
    }

    [Fact]
    public async Task PreLedgerSale_SecondPartialReturn_CountsTheFirstReversal()
    {
        await using CrmDbContext db = CreateDb();
        Customer customer = await SeedCustomerAsync(db, points: 500, ledgerStart: _ledgerStart);
        Guid orderId = Guid.NewGuid();
        DateTime completedAt = _ledgerStart.AddDays(-3);

        await HandleAsync(db, customer, orderId, completedAt, share: 0.5m, refunded: 50m, pointsRedeemed: 0, total: 100m);
        await HandleAsync(db, customer, orderId, completedAt, share: 1m, refunded: 100m, pointsRedeemed: 0, total: 100m);

        (await PointsOf(db, customer)).Should().Be(400);
        List<int> reversals = await db.LoyaltyTransactions
            .Where(t => t.OrderId == orderId && t.Kind == LoyaltyTransactionKind.Reverse)
            .Select(t => t.Delta)
            .ToListAsync();
        reversals.Should().BeEquivalentTo([-50, -50]);
    }

    private static CrmDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<CrmDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options,
            new Mock<IPublisher>().Object);

    private static async Task<Customer> SeedCustomerAsync(CrmDbContext db, int points, DateTime? ledgerStart)
    {
        Customer customer = Customer.Create(_tenantId, "Sara");
        customer.AddLoyaltyPoints(points);
        db.Customers.Add(customer);
        if (ledgerStart is DateTime start)
        {
            db.LoyaltyLedgerStart.Add(LoyaltyLedgerStart.Create(start));
        }

        await db.SaveChangesAsync();
        return customer;
    }

    private static Task HandleAsync(
        CrmDbContext db, Customer customer, Guid orderId, DateTime completedAt,
        decimal share, decimal refunded, int pointsRedeemed, decimal total = 115m)
    {
        OrderReturnedLoyaltyHandler handler = new(db, NullLogger<OrderReturnedLoyaltyHandler>.Instance);
        ReturnOrderCompletedDomainEvent notification = new(
            Guid.NewGuid(), orderId, _tenantId, Guid.NewGuid(), refunded, "SAR", [], true,
            Loyalty: new ReturnOrderCompletedDomainEvent.CustomerLoyalty(
                customer.Id.Value, total, pointsRedeemed, pointsRedeemed * 0.05m, share, refunded, completedAt));
        return handler.Handle(notification, CancellationToken.None);
    }

    private static async Task<int> PointsOf(CrmDbContext db, Customer customer) =>
        (await db.Customers.AsNoTracking().SingleAsync(c => c.Id == customer.Id)).LoyaltyPoints;
}
