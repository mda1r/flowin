using ErrorOr;
using FluentAssertions;
using FluentValidation.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Moq;
using NexusPOS.POS.Application.Commands.Checkout;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.UnitTests.Application;

// Add-ons picked at the till: the server prices them from the catalogue, refuses one that is off, belongs to another
// drink or breaks its group's rule, keeps them on the line and sends their names to the kitchen. A sale made offline
// is kept and logged instead, and a payload from before add-ons still checks out.
public sealed class CheckoutModifierTests
{
    // A large latte is 23 on the shelf (VAT included). Its milk group is required, pick exactly one: full cream is free,
    // oat is 3 with VAT (2.6087 net). Its extras group is optional, up to two: an extra shot is 2 with VAT (1.7391 net).
    // The syrup group is attached to the mocha only. Water has no groups.
    private static readonly Guid _latte = Guid.NewGuid();
    private static readonly Guid _latteProduct = Guid.NewGuid();
    private static readonly Guid _mochaProduct = Guid.NewGuid();
    private static readonly Guid _water = Guid.NewGuid();
    private static readonly Guid _waterProduct = Guid.NewGuid();

    private static readonly Guid _milk = Guid.NewGuid();
    private static readonly Guid _extras = Guid.NewGuid();
    private static readonly Guid _syrups = Guid.NewGuid();

    private static readonly Guid _fullCream = Guid.NewGuid();
    private static readonly Guid _oat = Guid.NewGuid();
    private static readonly Guid _shot = Guid.NewGuid();
    private static readonly Guid _oldCream = Guid.NewGuid();
    private static readonly Guid _caramel = Guid.NewGuid();

    private static readonly ModifierLookup _catalog = new(
        new Dictionary<Guid, ModifierOptionInfo>
        {
            [_fullCream] = new(_fullCream, _milk, "حليب كامل", 0m, true),
            [_oat] = new(_oat, _milk, "شوفان", 2.6087m, true),
            [_oldCream] = new(_oldCream, _milk, "كريمة", 1m, false),
            [_shot] = new(_shot, _extras, "شوت إضافي", 1.7391m, true),
            [_caramel] = new(_caramel, _syrups, "كراميل", 1m, true),
        },
        new Dictionary<Guid, ModifierGroupRules>
        {
            [_milk] = new(_milk, "الحليب", true, 1, 1, true, [_latteProduct]),
            [_extras] = new(_extras, "إضافات", false, 0, 2, true, [_latteProduct]),
            [_syrups] = new(_syrups, "النكهات", false, 0, 1, true, [_mochaProduct]),
        });

    // What the till sends for a gross price: net to four places.
    private static decimal Net(decimal gross) => Math.Round(gross / 1.15m, 4);

    private static PosDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<PosDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options,
            new Mock<IPublisher>().Object);

    private static CheckoutOrderCommandHandler Handler(
        PosDbContext db, Guid tenantId, List<KitchenTicketRequestedDomainEvent>? tickets = null, ModifierLookup? catalog = null)
    {
        Mock<ICustomerLoyaltyDirectory> loyalty = new();
        loyalty.Setup(l => l.GetRulesAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(LoyaltyRules.Default);
        Mock<IOrderNumberSequence> numbers = new();
        numbers.Setup(n => n.NextAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(1001);
        Mock<IVariantPriceDirectory> prices = new();
        prices.Setup(p => p.GetSalePricesAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal> { [_latte] = 23m, [_water] = 2m });
        prices.Setup(p => p.GetCostPricesAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal>());
        prices.Setup(p => p.GetProductIdsAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, Guid> { [_latte] = _latteProduct, [_water] = _waterProduct });
        Mock<IRecipeCostDirectory> recipes = new();
        recipes.Setup(r => r.GetCostsAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal>());

        // The catalogue answers for the token's tenant only; any other tenant sees no add-ons.
        Mock<IModifierOptionDirectory> modifiers = new();
        modifiers.Setup(m => m.GetAsync(
                It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(ModifierLookup.Empty);
        modifiers.Setup(m => m.GetAsync(
                tenantId, It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(catalog ?? _catalog);

        Mock<IPublisher> publisher = new();
        publisher.Setup(p => p.Publish(It.IsAny<KitchenTicketRequestedDomainEvent>(), It.IsAny<CancellationToken>()))
            .Callback<KitchenTicketRequestedDomainEvent, CancellationToken>((e, _) => tickets?.Add(e))
            .Returns(Task.CompletedTask);

        return new CheckoutOrderCommandHandler(
            db, loyalty.Object, numbers.Object, prices.Object, recipes.Object, modifiers.Object, publisher.Object);
    }

    // A cashier sale paid by card, so the payment always adds up and the price check runs.
    private static CheckoutOrderCommand Sale(
        Guid tenantId, IReadOnlyList<CheckoutOrderCommand.Line> lines, DateTime? offlineAt = null) =>
        new(tenantId, Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, null, lines,
            0, PaymentMethod.Card, 0m, null, null, offlineAt, Kitchen: new(null, true));

    private static CheckoutOrderCommand.Line Latte(decimal gross, params Guid[] options) =>
        new(_latte, "لاتيه", "كبير", Net(gross), 0m, 1m, ModifierOptionIds: options);

    [Fact]
    public async Task PriceWithAddOns_IsAccepted_KeptOnTheLine_AndSentToTheKitchen()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();
        List<KitchenTicketRequestedDomainEvent> tickets = [];

        ErrorOr<OrderResponse> result = await Handler(db, tenantId, tickets)
            .Handle(Sale(tenantId, [Latte(28m, _oat, _shot)]), CancellationToken.None);

        result.IsError.Should().BeFalse();
        OrderLineResponse line = result.Value.Lines.Should().ContainSingle().Subject;
        line.UnitPrice.Should().Be(Net(28m));
        line.Modifiers.Should().BeEquivalentTo(
            [new OrderLineModifierResponse(_oat, "شوفان", 2.6087m), new OrderLineModifierResponse(_shot, "شوت إضافي", 1.7391m)],
            o => o.WithStrictOrdering());

        KitchenTicketRequestedDomainEvent ticket = tickets.Should().ContainSingle().Subject;
        ticket.Lines.Single().Modifiers.Should().Equal("شوفان", "شوت إضافي");
    }

    [Fact]
    public async Task AddOns_AreReadBackFromTheDatabase()
    {
        string name = Guid.NewGuid().ToString();
        DbContextOptions<PosDbContext> options = new DbContextOptionsBuilder<PosDbContext>()
            .UseInMemoryDatabase(name)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        Guid tenantId = Guid.NewGuid();
        await using (PosDbContext db = new(options, new Mock<IPublisher>().Object))
        {
            ErrorOr<OrderResponse> result = await Handler(db, tenantId)
                .Handle(Sale(tenantId, [Latte(26m, _oat), new(_water, "ماء", "افتراضي", Net(2m), 0m, 1m)]), CancellationToken.None);
            result.IsError.Should().BeFalse();
        }

        await using PosDbContext fresh = new(options, new Mock<IPublisher>().Object);
        Order order = await fresh.Orders.Include(o => o.Lines).SingleAsync();
        order.Lines.Single(l => l.VariantId == _latte).Modifiers.Should().Equal(new OrderLineModifier(_oat, "شوفان", 2.6087m));
        order.Lines.Single(l => l.VariantId == _water).Modifiers.Should().BeNull();
    }

    [Fact]
    public async Task PriceBelowShelfPlusAddOns_IsRejected()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();

        // Charged as a plain latte with full cream although oat was picked.
        ErrorOr<OrderResponse> result = await Handler(db, tenantId)
            .Handle(Sale(tenantId, [Latte(23m, _oat)]), CancellationToken.None);

        result.FirstError.Code.Should().Be("POS.PriceBelowCatalog");
        (await db.Orders.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task AFreeAddOnAtTheShelfPrice_IsAccepted()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();

        ErrorOr<OrderResponse> result = await Handler(db, tenantId)
            .Handle(Sale(tenantId, [Latte(23m, _fullCream)]), CancellationToken.None);

        result.IsError.Should().BeFalse();
    }

    [Fact]
    public async Task AnOptionOfAnotherDrink_IsRejected()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();

        ErrorOr<OrderResponse> result = await Handler(db, tenantId)
            .Handle(Sale(tenantId, [Latte(24.15m, _fullCream, _caramel)]), CancellationToken.None);

        result.FirstError.Code.Should().Be("POS.ModifierNotForProduct");
        result.FirstError.Description.Should().Contain("كراميل");
        (await db.Orders.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task AnUnknownOrSwitchedOffOption_IsRejected()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();
        CheckoutOrderCommandHandler handler = Handler(db, tenantId);

        (await handler.Handle(Sale(tenantId, [Latte(25m, _oldCream)]), CancellationToken.None))
            .FirstError.Code.Should().Be("POS.ModifierUnavailable");
        (await handler.Handle(Sale(tenantId, [Latte(23m, _fullCream, Guid.NewGuid())]), CancellationToken.None))
            .FirstError.Code.Should().Be("POS.ModifierUnavailable");
    }

    [Fact]
    public async Task AnotherTenantsOptions_AreUnknown()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();
        Guid otherTenant = Guid.NewGuid();

        // The handler asks for the command's tenant (the JWT claim); the catalogue of another tenant is never read.
        ErrorOr<OrderResponse> result = await Handler(db, otherTenant)
            .Handle(Sale(tenantId, [Latte(26m, _oat)]), CancellationToken.None);

        result.FirstError.Code.Should().Be("POS.ModifierUnavailable");
    }

    [Fact]
    public async Task TooManyPicksInAGroup_IsRejected()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();

        ErrorOr<OrderResponse> result = await Handler(db, tenantId)
            .Handle(Sale(tenantId, [Latte(26m, _fullCream, _oat)]), CancellationToken.None);

        result.FirstError.Code.Should().Be("POS.ModifierSelection");
        result.FirstError.Description.Should().Contain("الحليب");
    }

    [Fact]
    public async Task ARequiredGroupLeftOut_IsRejectedOnline()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();

        ErrorOr<OrderResponse> result = await Handler(db, tenantId)
            .Handle(Sale(tenantId, [Latte(25m, _shot)]), CancellationToken.None);

        result.FirstError.Code.Should().Be("POS.ModifierRequired");
        result.FirstError.Description.Should().Be("اختر «الحليب» لـ«لاتيه».");
        (await db.Orders.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ARequiredGroupLeftOut_IsKeptOffline_AndLoggedForReview()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();

        ErrorOr<OrderResponse> result = await Handler(db, tenantId)
            .Handle(Sale(tenantId, [Latte(25m, _shot)], DateTime.UtcNow.AddHours(-1)), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Lines.Single().Modifiers.Should().ContainSingle(m => m.Id == _shot);
        ActivityLog log = await db.ActivityLogs.SingleAsync();
        log.Details.Should().Contain("إضافات لا تطابق الكتالوج: لاتيه");
    }

    [Fact]
    public async Task AnOptionDeletedSinceTheOfflineSale_IsLogged_AndLeftOffTheLine()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();

        ErrorOr<OrderResponse> result = await Handler(db, tenantId)
            .Handle(Sale(tenantId, [Latte(23m, _fullCream, Guid.NewGuid())], DateTime.UtcNow.AddHours(-1)), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Lines.Single().Modifiers.Should().Equal(new OrderLineModifierResponse(_fullCream, "حليب كامل", 0m));
        (await db.ActivityLogs.SingleAsync()).Details.Should().Contain("إضافات");
    }

    [Fact]
    public async Task AnOldPayloadWithoutAddOns_StillChecksOut()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();
        List<KitchenTicketRequestedDomainEvent> tickets = [];

        // No ModifierOptionIds at all, as a till or an offline queue from before add-ons sends it.
        CheckoutOrderCommand.Line water = new(_water, "ماء", "افتراضي", Net(2m), 0m, 2m);
        ErrorOr<OrderResponse> result = await Handler(db, tenantId, tickets)
            .Handle(Sale(tenantId, [water]), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Lines.Single().Modifiers.Should().BeNull();
        tickets.Single().Lines.Single().Modifiers.Should().BeNull();
        (await db.ActivityLogs.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task AnOldPayload_ChecksOutWhenTheCatalogueHasNoAddOns()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();

        ErrorOr<OrderResponse> result = await Handler(db, tenantId, catalog: ModifierLookup.Empty)
            .Handle(Sale(tenantId, [new(_latte, "لاتيه", "كبير", Net(23m), 0m, 1m)]), CancellationToken.None);

        result.IsError.Should().BeFalse();
    }

    [Fact]
    public async Task AManagerRepricing_StillNeedsTheRequiredChoice()
    {
        await using PosDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();

        ErrorOr<OrderResponse> result = await Handler(db, tenantId)
            .Handle(Sale(tenantId, [Latte(10m)]) with { ByOwnerOrManager = true }, CancellationToken.None);

        result.FirstError.Code.Should().Be("POS.ModifierRequired");
    }

    [Fact]
    public void PriceCheck_AddsVatToTheNetAddOnPrice()
    {
        CheckoutOrderCommand sale = Sale(Guid.NewGuid(), [Latte(28m, _oat, _shot)]);
        Dictionary<Guid, decimal> shelf = new() { [_latte] = 23m };

        CatalogPriceCheck.Check(sale, shelf, _catalog).IsError.Should().BeFalse();
        CatalogPriceCheck.Check(sale with { Lines = [Latte(27.9m, _oat, _shot)] }, shelf, _catalog).IsError.Should().BeTrue();
        // Without the catalogue's add-ons the size alone is compared, as before add-ons existed.
        CatalogPriceCheck.Check(sale with { Lines = [Latte(23m, _oat)] }, shelf).IsError.Should().BeFalse();
    }

    [Fact]
    public void Validator_CapsTheAddOnsPerLine()
    {
        Guid[] many = [.. Enumerable.Range(0, CheckoutOrderCommandValidator.MaxModifiersPerLine + 1).Select(_ => Guid.NewGuid())];

        ValidationResult result = new CheckoutOrderCommandValidator().Validate(Sale(Guid.NewGuid(), [Latte(23m, many)]));

        result.IsValid.Should().BeFalse();
        new CheckoutOrderCommandValidator().Validate(Sale(Guid.NewGuid(), [Latte(23m, _oat)])).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Order_FoldsTheSameAddOnsInAnyOrder_AndKeepsOthersApart()
    {
        Order order = Order.Create(Guid.NewGuid(), Guid.NewGuid(), "SAR", null, 0.15m);
        OrderLineModifier oat = new(_oat, "شوفان", 2.6087m);
        OrderLineModifier shot = new(_shot, "شوت إضافي", 1.7391m);

        order.AddLine(_latte, "لاتيه", "كبير", 24.3478m, 0m, 1m, modifiers: [oat, shot]);
        order.AddLine(_latte, "لاتيه", "كبير", 24.3478m, 0m, 1m, modifiers: [shot, oat]);
        order.AddLine(_latte, "لاتيه", "كبير", 22.6087m, 0m, 1m, modifiers: [oat]);
        order.AddLine(_latte, "لاتيه", "كبير", 20m, 0m, 1m);

        order.Lines.Should().HaveCount(3);
        order.Lines[0].Quantity.Should().Be(2m);
        order.Lines[0].Modifiers.Should().Equal(oat, shot);
        order.Lines[2].Modifiers.Should().BeNull();
    }
}
