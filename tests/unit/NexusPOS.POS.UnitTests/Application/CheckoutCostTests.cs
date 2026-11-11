using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Moq;
using NexusPOS.POS.Application.Commands.Checkout;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.UnitTests.Application;

// The cost on a sold line comes from the server: the recipe when the drink has one, the catalog otherwise,
// never the number the till sends.
public sealed class CheckoutCostTests
{
    private static readonly Guid _latte = Guid.NewGuid();
    private static readonly Guid _water = Guid.NewGuid();
    private static readonly Guid _cookie = Guid.NewGuid();

    private static PosDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<PosDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options,
            new Mock<IPublisher>().Object);

    // The latte has a recipe (2.64) and a stale catalog cost (5); the water only a catalog cost; the cookie neither.
    private static CheckoutOrderCommandHandler Handler(PosDbContext db, Guid tenantId)
    {
        Mock<ICustomerLoyaltyDirectory> loyalty = new();
        loyalty.Setup(l => l.GetRulesAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(LoyaltyRules.Default);
        Mock<IOrderNumberSequence> numbers = new();
        numbers.Setup(n => n.NextAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(1001);
        Mock<IVariantPriceDirectory> prices = new();
        prices.Setup(p => p.GetProductIdsAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, Guid>());
        prices.Setup(p => p.GetCostPricesAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal> { [_latte] = 5m, [_water] = 0.8m });
        Mock<IRecipeCostDirectory> recipes = new();
        recipes.Setup(r => r.GetCostsAsync(tenantId, It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal> { [_latte] = 2.64m });
        return new CheckoutOrderCommandHandler(
            db, loyalty.Object, numbers.Object, prices.Object, recipes.Object, CheckoutDirectories.NoModifiers(), CheckoutDirectories.NoCodes(), new Mock<IPublisher>().Object, CheckoutDirectories.VatOn());
    }

    // The till claims a cost of 99 on every line. Card, so the payment always adds up; the manager role skips the price check.
    private static CheckoutOrderCommand Sale(Guid tenantId, DateTime? offlineAt = null) =>
        new(tenantId, Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, null,
            [
                new(_latte, "لاتيه", "كبير", 20m, 99m, 2m),
                new(_water, "ماء", "افتراضي", 2m, 99m, 1m),
                new(_cookie, "كوكيز", "افتراضي", 6m, 99m, 1m),
            ],
            0, PaymentMethod.Card, 0m, null, null, offlineAt, ByOwnerOrManager: true);

    [Fact]
    public async Task Checkout_StoresRecipeCost_ThenCatalogCost_AndIgnoresTheTill()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();

        ErrorOr<OrderResponse> result = await Handler(db, tenantId).Handle(Sale(tenantId), CancellationToken.None);

        result.IsError.Should().BeFalse();
        Order order = await db.Orders.Include(o => o.Lines).SingleAsync();
        order.Lines.Single(l => l.VariantId == _latte).CostPrice.Should().Be(2.64m);
        order.Lines.Single(l => l.VariantId == _water).CostPrice.Should().Be(0.8m);
        order.Lines.Single(l => l.VariantId == _cookie).CostPrice.Should().Be(0m);
        result.Value.Lines.Single(l => l.VariantId == _latte).CostPrice.Should().Be(2.64m);
    }

    [Fact]
    public async Task OfflineSync_GetsTheSameServerCost()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();

        ErrorOr<OrderResponse> result = await Handler(db, tenantId)
            .Handle(Sale(tenantId, DateTime.UtcNow.AddHours(-1)), CancellationToken.None);

        result.IsError.Should().BeFalse();
        Order order = await db.Orders.Include(o => o.Lines).SingleAsync();
        order.Lines.Should().NotContain(l => l.CostPrice == 99m);
        order.Lines.Single(l => l.VariantId == _latte).CostPrice.Should().Be(2.64m);
    }

    [Fact]
    public void UnitCosts_PrefersTheRecipe()
    {
        Dictionary<Guid, decimal> costs = CheckoutBuilder.UnitCosts(
            new Dictionary<Guid, decimal> { [_latte] = 2.64m },
            new Dictionary<Guid, decimal> { [_latte] = 5m, [_water] = 0.8m });

        costs.Should().BeEquivalentTo(new Dictionary<Guid, decimal> { [_latte] = 2.64m, [_water] = 0.8m });
    }

    [Fact]
    public void Build_WithoutServerCosts_NeverUsesTheTillCost()
    {
        ErrorOr<Order> built = CheckoutBuilder.Build(Sale(Guid.NewGuid()), LoyaltyRules.Default);

        built.Value.Lines.Should().OnlyContain(l => l.CostPrice == 0m);
    }
}
