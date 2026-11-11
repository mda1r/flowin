using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Moq;
using NexusPOS.POS.Application.Commands.Checkout;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.UnitTests.Application;

// The whole checkout against an in-memory store: a split that does not add up is refused live, while one rung up
// offline is saved and left in the manager's review log.
public sealed class CheckoutPaymentReviewTests
{
    private static PosDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<PosDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options,
            new Mock<IPublisher>().Object);

    private static CheckoutOrderCommandHandler Handler(PosDbContext db)
    {
        Mock<ICustomerLoyaltyDirectory> loyalty = new();
        loyalty.Setup(l => l.GetRulesAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(LoyaltyRules.Default);
        Mock<IOrderNumberSequence> numbers = new();
        numbers.Setup(n => n.NextAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(1001);
        Mock<IVariantPriceDirectory> prices = new();
        prices.Setup(p => p.GetProductIdsAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, Guid>());
        prices.Setup(p => p.GetCostPricesAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal>());
        Mock<IRecipeCostDirectory> recipes = new();
        recipes.Setup(r => r.GetCostsAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal>());
        return new CheckoutOrderCommandHandler(
            db, loyalty.Object, numbers.Object, prices.Object, recipes.Object, CheckoutDirectories.NoModifiers(), CheckoutDirectories.NoCodes(), new Mock<IPublisher>().Object, CheckoutDirectories.VatOn());
    }

    // A latte at 20 before VAT: total 23. The manager role skips the catalog price lookup.
    private static CheckoutOrderCommand Split(decimal cash, decimal card, DateTime? offlineAt = null) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, null,
            [new(Guid.NewGuid(), "لاتيه", "كبير", 20m, 4m, 1m)],
            0, PaymentMethod.Split, cash + card, cash, card, offlineAt, ByOwnerOrManager: true, UserName: "سارة");

    [Fact]
    public async Task OnlineSplitMismatch_IsRefused_AndNothingIsSaved()
    {
        await using PosDbContext db = CreateDb();

        ErrorOr<OrderResponse> result = await Handler(db).Handle(Split(5m, 10m), CancellationToken.None);

        result.FirstError.Should().Be(PosErrors.SplitMismatch);
        (await db.Orders.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task OfflineSplitMismatch_IsSaved_AndLoggedForReview()
    {
        await using PosDbContext db = CreateDb();

        ErrorOr<OrderResponse> result = await Handler(db)
            .Handle(Split(5m, 10m, DateTime.UtcNow.AddHours(-1)), CancellationToken.None);

        result.IsError.Should().BeFalse();
        Order order = await db.Orders.SingleAsync();
        order.SplitCash.Should().Be(5m);
        order.SplitCard.Should().Be(10m);
        ActivityLog log = await db.ActivityLogs.SingleAsync();
        log.Details.Should().Contain("1001").And.Contain("لا يساوي الإجمالي 23.00");
    }

    [Fact]
    public async Task OfflineSplitThatAddsUp_LeavesNoReview()
    {
        await using PosDbContext db = CreateDb();

        ErrorOr<OrderResponse> result = await Handler(db)
            .Handle(Split(13m, 10m, DateTime.UtcNow.AddHours(-1)), CancellationToken.None);

        result.IsError.Should().BeFalse();
        (await db.ActivityLogs.CountAsync()).Should().Be(0);
    }
}
