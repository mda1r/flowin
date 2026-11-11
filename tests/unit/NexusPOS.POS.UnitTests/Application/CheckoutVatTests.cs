using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Moq;
using NexusPOS.POS.Application.Commands.Checkout;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.UnitTests.Application;

// The shop's VAT setting decides the rate: a shop without VAT sells with none, and a till still on the old setting
// is sent back online but its offline sale is kept and logged.
public sealed class CheckoutVatTests
{
    private static PosDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<PosDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options,
            new Mock<IPublisher>().Object);

    private static CheckoutOrderCommandHandler Handler(PosDbContext db, bool vatEnabled)
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
            db, loyalty.Object, numbers.Object, prices.Object, recipes.Object, CheckoutDirectories.NoModifiers(), CheckoutDirectories.NoCodes(), new Mock<IPublisher>().Object, CheckoutDirectories.VatPolicy(vatEnabled));
    }

    // A latte at 20, cash; the manager role skips the catalog price lookup.
    private static CheckoutOrderCommand Sale(decimal taxRate, DateTime? offlineAt = null) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "SAR", taxRate, null,
            [new(Guid.NewGuid(), "لاتيه", "كبير", 20m, 4m, 1m)],
            0, PaymentMethod.Cash, 100m, null, null, offlineAt, ByOwnerOrManager: true, UserName: "سارة");

    [Fact]
    public async Task ShopWithoutVat_SellsWithNoTax()
    {
        await using PosDbContext db = CreateDb();

        ErrorOr<OrderResponse> result = await Handler(db, vatEnabled: false).Handle(Sale(0m), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.TaxAmount.Should().Be(0m);
        result.Value.TotalAmount.Should().Be(20m);
    }

    [Fact]
    public async Task OnlineSaleWithTheOtherSetting_IsSentBack()
    {
        await using PosDbContext db = CreateDb();

        (await Handler(db, vatEnabled: false).Handle(Sale(0.15m), CancellationToken.None)).FirstError
            .Should().Be(PosErrors.TaxSettingChanged);
        (await Handler(db, vatEnabled: true).Handle(Sale(0m), CancellationToken.None)).FirstError
            .Should().Be(PosErrors.TaxSettingChanged);
        (await db.Orders.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task OfflineSaleWithTheOldSetting_IsKept_AndLogged()
    {
        await using PosDbContext db = CreateDb();

        ErrorOr<OrderResponse> result = await Handler(db, vatEnabled: false)
            .Handle(Sale(0.15m, DateTime.UtcNow.AddHours(-1)), CancellationToken.None);

        result.IsError.Should().BeFalse();
        (await db.ActivityLogs.SingleAsync()).Details.Should().Contain("إعداد المتجر");
    }
}
