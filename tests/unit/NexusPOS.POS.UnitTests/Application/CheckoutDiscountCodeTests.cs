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
using NexusPOS.POS.Domain.Events;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.UnitTests.Application;

// An owner's discount code at the cafe till: the server takes the percentage from the code and refuses a sale whose
// till charged another value, the cashier needs no cap or PIN for it, one sale counts one use, and a 100% code gives a
// free sale that still completes. Offline, the till's discount stands and anything the code no longer backs is reviewed.
public sealed class CheckoutDiscountCodeTests
{
    private static readonly Guid _latte = Guid.NewGuid();

    private static readonly DiscountCodeLookup _staff = new("STAFF", "موظفين", true, 10m, 0m, null);
    private static readonly DiscountCodeLookup _half = new("HALF", "نص", true, 50m, 0m, null);
    private static readonly DiscountCodeLookup _free = new("FREE", "ضيافة", true, 100m, 0m, null);

    private static PosDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<PosDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options,
            new Mock<IPublisher>().Object);

    // codes: what the store holds, keyed by the stored (upper case) code. Lookups are case-insensitive like the real store.
    private static (CheckoutOrderCommandHandler Handler, Mock<IDiscountCodeDirectory> Codes, Mock<IPublisher> Publisher) Setup(
        PosDbContext db, params DiscountCodeLookup[] codes)
    {
        Mock<ICustomerLoyaltyDirectory> loyalty = new();
        loyalty.Setup(l => l.GetRulesAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(LoyaltyRules.Default);
        Mock<IOrderNumberSequence> numbers = new();
        numbers.Setup(n => n.NextAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(1001);
        Mock<IVariantPriceDirectory> prices = new();
        prices.Setup(p => p.GetProductIdsAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, Guid>());
        prices.Setup(p => p.GetSalePricesAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal> { [_latte] = 23m });
        prices.Setup(p => p.GetCostPricesAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal>());
        Mock<IRecipeCostDirectory> recipes = new();
        recipes.Setup(r => r.GetCostsAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal>());
        Mock<IDiscountCodeDirectory> directory = new();
        directory.Setup(d => d.FindAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid _, string code, DateTime? _, CancellationToken _) =>
                codes.FirstOrDefault(c => string.Equals(c.Code, code.Trim(), StringComparison.OrdinalIgnoreCase)));
        directory.Setup(d => d.RedeemAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        Mock<IPublisher> publisher = new();
        CheckoutOrderCommandHandler handler = new(
            db, loyalty.Object, numbers.Object, prices.Object, recipes.Object, CheckoutDirectories.NoModifiers(),
            directory.Object, publisher.Object);
        return (handler, directory, publisher);
    }

    // Two lattes at 20 before VAT (46.00 with VAT), rung up by a cashier, paid by card unless told otherwise.
    private static CheckoutOrderCommand Sale(
        string? code,
        DiscountType type = DiscountType.None,
        decimal value = 0m,
        PaymentMethod method = PaymentMethod.Card,
        decimal tendered = 0m,
        DateTime? offlineAt = null) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, null,
            [new(_latte, "لاتيه", "كبير", 20m, 0m, 2m)],
            0, method, tendered, null, null, offlineAt, type, value, UserName: "سارة", DiscountCode: code);

    [Fact]
    public async Task ValidCode_IsPricedFromTheCode()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, _) = Setup(db, _staff);

        ErrorOr<OrderResponse> result = await handler.Handle(
            Sale("  staff ", DiscountType.Percentage, 10m), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.DiscountAmount.Should().Be(4m);
        result.Value.TotalAmount.Should().Be(41.40m);
        result.Value.DiscountCode.Should().Be("STAFF");
        Order order = await db.Orders.SingleAsync();
        order.DiscountCode.Should().Be("STAFF");
        order.OrderDiscount.Type.Should().Be(DiscountType.Percentage);
        order.OrderDiscount.Value.Should().Be(10m);
    }

    [Theory]
    [InlineData(60)]
    [InlineData(5)]
    [InlineData(0)]
    public async Task OnlineSale_WhoseTillChargedAnotherValue_IsRefused(int tillPercent)
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, Mock<IDiscountCodeDirectory> codes, _) = Setup(db, _staff);

        // The owner changed STAFF to 10% after the till applied it at another value.
        ErrorOr<OrderResponse> result = await handler.Handle(
            Sale("STAFF", tillPercent == 0 ? DiscountType.None : DiscountType.Percentage, tillPercent), CancellationToken.None);

        result.FirstError.Should().Be(PosErrors.DiscountCodeChanged);
        result.FirstError.Description.Should().Be("تغيّرت قيمة كود الخصم، أعد تطبيقه");
        (await db.Orders.CountAsync()).Should().Be(0);
        codes.Verify(c => c.RedeemAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ValidCode_PastTheCashierCap_NeedsNoPin()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, _) = Setup(db, _half);

        ErrorOr<OrderResponse> withCode = await handler.Handle(Sale("HALF", DiscountType.Percentage, 50m), CancellationToken.None);
        ErrorOr<OrderResponse> byHand = await handler.Handle(Sale(null, DiscountType.Percentage, 50m), CancellationToken.None);

        withCode.IsError.Should().BeFalse();
        withCode.Value.TotalAmount.Should().Be(23m);
        byHand.IsError.Should().BeTrue("the same 50% typed by hand is over the default 10% cashier cap");
        byHand.FirstError.Code.Should().Be("POS.DiscountNeedsManager");
    }

    [Fact]
    public async Task FreeCode_GivesAZeroBill_PaidWithNoCash()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, Mock<IPublisher> publisher) = Setup(db, _free);

        ErrorOr<OrderResponse> result = await handler.Handle(
            Sale("free", DiscountType.Percentage, 100m, PaymentMethod.Cash, 0m), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Status.Should().Be(OrderStatus.Completed);
        result.Value.TotalAmount.Should().Be(0m);
        result.Value.TaxAmount.Should().Be(0m);
        result.Value.ChangeDue.Should().Be(0m);
        result.Value.Lines.Single().RefundUnitPrice.Should().Be(0m, "a return of a free drink refunds nothing");
        publisher.Verify(p => p.Publish(
            It.Is<IDomainEvent>(e => e is OrderCompletedDomainEvent && ((OrderCompletedDomainEvent)e).Total == 0m),
            It.IsAny<CancellationToken>()), Times.Once);
        LoyaltyRules.Default.PointsEarned(0m).Should().Be(0);
    }

    [Fact]
    public async Task FreeSale_ReturnRefundsZero()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, _) = Setup(db, _free);
        await handler.Handle(Sale("FREE", DiscountType.Percentage, 100m, PaymentMethod.Cash), CancellationToken.None);
        Order order = await db.Orders.Include(o => o.Lines).SingleAsync();

        ErrorOr<ReturnOrder> refund = ReturnOrder.Create(
            order, [], [(order.Lines.Single().Id.Value, 2m, ReturnReason.CustomerRequest)], RefundMethod.Cash);

        refund.IsError.Should().BeFalse();
        refund.Value.RefundAmount.Should().Be(0m);
        refund.Value.TaxAmount.Should().Be(0m);
    }

    [Fact]
    public async Task OneSale_CountsOneUse_EvenWhenResent()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, Mock<IDiscountCodeDirectory> codes, _) = Setup(db, _staff);
        CheckoutOrderCommand sale = Sale("STAFF", DiscountType.Percentage, 10m);

        ErrorOr<OrderResponse> first = await handler.Handle(sale, CancellationToken.None);
        ErrorOr<OrderResponse> again = await handler.Handle(sale, CancellationToken.None);

        first.IsError.Should().BeFalse();
        again.Value.Id.Should().Be(first.Value.Id);
        codes.Verify(c => c.RedeemAsync(It.IsAny<Guid>(), "STAFF", It.IsAny<CancellationToken>()), Times.Once);
        (await db.Orders.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task UnknownCode_IsRefusedOnline_AndNothingIsCounted()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, Mock<IDiscountCodeDirectory> codes, _) = Setup(db, _staff);

        ErrorOr<OrderResponse> result = await handler.Handle(Sale("NOPE", DiscountType.Percentage, 10m), CancellationToken.None);

        result.FirstError.Code.Should().Be("POS.DiscountCodeInvalid");
        result.FirstError.Description.Should().Be("كود الخصم غير صالح أو منتهي");
        (await db.Orders.CountAsync()).Should().Be(0);
        codes.Verify(c => c.RedeemAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData("كود الخصم غير مفعّل")]
    [InlineData("كود الخصم منتهي الصلاحية")]
    [InlineData("كود الخصم استُخدم الحد الأقصى من المرات")]
    public async Task UnusableCode_IsRefusedOnline_WithItsReason(string problem)
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, _) = Setup(db, _staff with { Problem = problem });

        ErrorOr<OrderResponse> result = await handler.Handle(Sale("STAFF"), CancellationToken.None);

        result.FirstError.Code.Should().Be("POS.DiscountCodeInvalid");
        result.FirstError.Description.Should().Be(problem);
        (await db.Orders.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task OfflineSale_WithACodeSwitchedOffSince_KeepsTheDiscount_AndIsLogged()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, Mock<IDiscountCodeDirectory> codes, _) =
            Setup(db, _staff with { Problem = "كود الخصم غير مفعّل" });

        ErrorOr<OrderResponse> result = await handler.Handle(
            Sale("STAFF", DiscountType.Percentage, 10m, offlineAt: DateTime.UtcNow.AddHours(-1)), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.TotalAmount.Should().Be(41.40m);
        result.Value.DiscountCode.Should().Be("STAFF");
        ActivityLog log = await db.ActivityLogs.SingleAsync();
        log.Details.Should().Contain("1001").And.Contain("STAFF").And.Contain("غير مفعّل");
        codes.Verify(c => c.RedeemAsync(It.IsAny<Guid>(), "STAFF", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task OfflineSale_WithACodeDeletedSince_KeepsTheTillsDiscount_AndIsLogged()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, _) = Setup(db);

        ErrorOr<OrderResponse> result = await handler.Handle(
            Sale("old", DiscountType.Percentage, 10m, offlineAt: DateTime.UtcNow.AddHours(-1)), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.TotalAmount.Should().Be(41.40m);
        result.Value.DiscountCode.Should().Be("OLD");
        (await db.ActivityLogs.SingleAsync()).Details.Should().Contain("OLD").And.Contain("لم يعد موجوداً").And.Contain("10%");
    }

    [Fact]
    public async Task OfflineSale_WithAMadeUpCode_IsReviewedAsACashierDiscountOverTheCap()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, Mock<IDiscountCodeDirectory> codes, _) = Setup(db);

        ErrorOr<OrderResponse> result = await handler.Handle(
            Sale("X1", DiscountType.Percentage, 100m, PaymentMethod.Cash, offlineAt: DateTime.UtcNow.AddHours(-1)),
            CancellationToken.None);

        result.IsError.Should().BeFalse("the sale already happened offline");
        (await db.ActivityLogs.SingleAsync()).Details
            .Should().Contain("X1").And.Contain("لم يعد موجوداً").And.Contain("خصم 100%").And.Contain("فوق حد الكاشير");
        codes.Verify(c => c.RedeemAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task OfflineSale_WithACodeUsedUp_IsReviewedAsACashierDiscountOverTheCap()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, _) = Setup(db, _free with { Problem = "كود الخصم استُخدم الحد الأقصى من المرات" });

        ErrorOr<OrderResponse> result = await handler.Handle(
            Sale("FREE", DiscountType.Percentage, 100m, PaymentMethod.Cash, offlineAt: DateTime.UtcNow.AddHours(-1)),
            CancellationToken.None);

        result.IsError.Should().BeFalse();
        (await db.ActivityLogs.SingleAsync()).Details.Should().Contain("الحد الأقصى").And.Contain("فوق حد الكاشير");
    }

    [Fact]
    public async Task OfflineSale_WhoseCodeChangedSince_KeepsWhatTheCustomerPaid_AndIsLogged()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, _) = Setup(db, _half);

        // The till applied HALF at 10%; the owner has raised it to 50% since.
        ErrorOr<OrderResponse> result = await handler.Handle(
            Sale("HALF", DiscountType.Percentage, 10m, offlineAt: DateTime.UtcNow.AddHours(-1)), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.TotalAmount.Should().Be(41.40m);
        result.Value.DiscountCode.Should().Be("HALF");
        (await db.ActivityLogs.SingleAsync()).Details.Should().Contain("HALF").And.Contain("تغيّر").And.Contain("خصم 50%");
    }

    [Fact]
    public async Task OfflineSale_AtMoreThanTheCodeGives_IsReviewedOverTheCap()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, _) = Setup(db, _staff);

        // STAFF is 10%, but the queued sale carries 50%.
        ErrorOr<OrderResponse> result = await handler.Handle(
            Sale("STAFF", DiscountType.Percentage, 50m, offlineAt: DateTime.UtcNow.AddHours(-1)), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.TotalAmount.Should().Be(23m);
        (await db.ActivityLogs.SingleAsync()).Details.Should().Contain("تغيّر").And.Contain("خصم 50% فوق حد الكاشير");
    }

    [Fact]
    public async Task OfflineSale_LooksTheCodeUpAtTheSalesOwnTime()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, Mock<IDiscountCodeDirectory> codes, _) = Setup(db, _staff);
        DateTime soldAt = DateTime.UtcNow.AddHours(-5);

        await handler.Handle(Sale("STAFF", DiscountType.Percentage, 10m, offlineAt: soldAt), CancellationToken.None);
        await handler.Handle(Sale("STAFF", DiscountType.Percentage, 10m), CancellationToken.None);

        codes.Verify(c => c.FindAsync(
            It.IsAny<Guid>(), "STAFF", It.Is<DateTime?>(d => d == soldAt), It.IsAny<CancellationToken>()), Times.Once);
        codes.Verify(c => c.FindAsync(
            It.IsAny<Guid>(), "STAFF", It.Is<DateTime?>(d => d != null && d.Value > soldAt.AddHours(4)), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task OfflineSale_WithAValidCode_LeavesNoReview()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, _) = Setup(db, _half);

        ErrorOr<OrderResponse> result = await handler.Handle(
            Sale("HALF", DiscountType.Percentage, 50m, offlineAt: DateTime.UtcNow.AddHours(-1)), CancellationToken.None);

        result.IsError.Should().BeFalse();
        (await db.ActivityLogs.CountAsync()).Should().Be(0, "a code is not a cashier discount over the cap");
    }

    [Fact]
    public async Task CodeBelowItsMinimum_IsRefusedOnline()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, _) = Setup(db, _staff with { MinOrderAmount = 50m });

        ErrorOr<OrderResponse> result = await handler.Handle(Sale("STAFF", DiscountType.Percentage, 10m), CancellationToken.None);

        result.FirstError.Should().Be(PosErrors.DiscountCodeMinOrder);
    }

    [Fact]
    public async Task FixedCode_TakesItsAmountWithVatOffTheBill()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, _) = Setup(db, new DiscountCodeLookup("FIVE", null, false, 5.75m, 0m, null));

        // The till sends the code's 5.75 with VAT as 5.00 net.
        ErrorOr<OrderResponse> result = await handler.Handle(Sale("FIVE", DiscountType.Fixed, 5m), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.TotalAmount.Should().Be(40.25m);
    }

    [Fact]
    public async Task FixedCode_LargerThanTheBill_MatchesTheTillsCappedAmount()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, _, _) = Setup(db, new DiscountCodeLookup("GIFT", null, false, 100m, 0m, null));

        // A 100 riyal code on a 46.00 bill: the till takes off the whole bill, 40.00 net.
        ErrorOr<OrderResponse> result = await handler.Handle(
            Sale("GIFT", DiscountType.Fixed, 40m, PaymentMethod.Cash), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.TotalAmount.Should().Be(0m);
    }

    [Fact]
    public async Task NoCode_KeepsTheTillsDiscount()
    {
        await using PosDbContext db = CreateDb();
        (CheckoutOrderCommandHandler handler, Mock<IDiscountCodeDirectory> codes, _) = Setup(db, _staff);

        ErrorOr<OrderResponse> result = await handler.Handle(Sale("  ", DiscountType.Percentage, 5m), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.TotalAmount.Should().Be(43.70m);
        result.Value.DiscountCode.Should().BeNull();
        codes.Verify(c => c.FindAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public void Validator_RefusesAnOverlongCode()
    {
        new CheckoutOrderCommandValidator().Validate(Sale(new string('A', 33))).IsValid.Should().BeFalse();
        new CheckoutOrderCommandValidator().Validate(Sale("STAFF")).IsValid.Should().BeTrue();
    }
}
