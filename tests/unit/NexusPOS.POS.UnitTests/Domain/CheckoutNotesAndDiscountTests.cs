using ErrorOr;
using FluentAssertions;
using NexusPOS.POS.Application.Commands.Checkout;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class CheckoutNotesAndDiscountTests
{
    private static readonly Guid _latte = Guid.NewGuid();
    private static readonly Guid _cookie = Guid.NewGuid();
    private static readonly Dictionary<Guid, decimal> _catalog = new() { [_latte] = 23m, [_cookie] = 11.50m };

    // Two lattes at 20 before VAT (23 listed) and a cookie at 10 (11.50 listed): subtotal 50, total 57.50.
    private static CheckoutOrderCommand Command(
        DiscountType discountType = DiscountType.None, decimal discountValue = 0m, bool isManager = false,
        decimal lattePrice = 20m, int points = 0, Guid? customer = null, DateTime? offlineCreatedAt = null) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, customer,
            [new(_latte, "لاتيه", "كبير", lattePrice, 4m, 2m, "حليب شوفان"), new(_cookie, "كوكيز", "", 10m, 2m, 1m)],
            points, PaymentMethod.Cash, 0m, null, null, offlineCreatedAt,
            discountType, discountValue, isManager);

    // ── Notes ────────────────────────────────────────────────────────────────

    [Fact]
    public void AddLine_SameItemWithDifferentNotes_StaysOnSeparateLines()
    {
        Order order = Order.Create(Guid.NewGuid(), Guid.NewGuid(), "SAR");

        order.AddLine(_latte, "لاتيه", "", 20m, 4m, 1m, notes: "بدون سكر");
        order.AddLine(_latte, "لاتيه", "", 20m, 4m, 1m, notes: "حليب شوفان");
        order.AddLine(_latte, "لاتيه", "", 20m, 4m, 1m, notes: "  بدون سكر ");

        order.Lines.Should().HaveCount(2);
        order.Lines.Single(l => l.Notes == "بدون سكر").Quantity.Should().Be(2m);
        order.SubtotalAmount.Should().Be(60m);
    }

    [Fact]
    public void AddLine_BlankAndMissingNotes_MergeIntoOneLine()
    {
        Order order = Order.Create(Guid.NewGuid(), Guid.NewGuid(), "SAR");

        order.AddLine(_latte, "لاتيه", "", 20m, 4m, 1m);
        order.AddLine(_latte, "لاتيه", "", 20m, 4m, 1m, notes: "   ");

        order.Lines.Should().ContainSingle().Which.Notes.Should().BeNull();
    }

    [Fact]
    public void Checkout_KeepsTheNotesOnTheSavedLines()
    {
        Order order = CheckoutBuilder.Build(Command(), LoyaltyRules.Default).Value;

        order.Lines.Single(l => l.VariantId == _latte).Notes.Should().Be("حليب شوفان");
        order.Lines.Single(l => l.VariantId == _cookie).Notes.Should().BeNull();
    }

    // ── Order discount ───────────────────────────────────────────────────────

    [Fact]
    public void PercentDiscount_WithinTheCashierCap_LowersTheTotal()
    {
        ErrorOr<Order> result = CheckoutBuilder.Build(Command(DiscountType.Percentage, 10m), LoyaltyRules.Default);

        result.IsError.Should().BeFalse();
        result.Value.DiscountAmount.Should().Be(5m);
        result.Value.TotalAmount.Should().Be(51.75m);
    }

    [Fact]
    public void PercentDiscount_AboveTheCap_IsRejectedForACashier()
    {
        CheckoutBuilder.Build(Command(DiscountType.Percentage, 25m), LoyaltyRules.Default)
            .FirstError.Code.Should().Be("POS.DiscountAboveCashierLimit");
    }

    [Fact]
    public void PercentDiscount_AboveTheCap_IsAllowedForAManager()
    {
        ErrorOr<Order> result = CheckoutBuilder.Build(Command(DiscountType.Percentage, 50m, isManager: true), LoyaltyRules.Default);

        result.IsError.Should().BeFalse();
        result.Value.TotalAmount.Should().Be(28.75m);
    }

    [Fact]
    public void FixedDiscount_IsCappedByItsShareOfTheBill()
    {
        // 10 of 50 is exactly the 20% cap; 10.5 is above it.
        CheckoutBuilder.Build(Command(DiscountType.Fixed, 10m), LoyaltyRules.Default).IsError.Should().BeFalse();
        CheckoutBuilder.Build(Command(DiscountType.Fixed, 10.5m), LoyaltyRules.Default)
            .FirstError.Code.Should().Be("POS.DiscountAboveCashierLimit");
    }

    [Fact]
    public void Discount_IsAppliedBeforeLoyaltyPoints()
    {
        // 10% off leaves 51.75 to pay; 100 points (5 SAR) bring it to 46.75.
        ErrorOr<Order> result = CheckoutBuilder.Build(
            Command(DiscountType.Percentage, 10m, points: 100, customer: Guid.NewGuid()), LoyaltyRules.Default);

        result.IsError.Should().BeFalse();
        Math.Round(result.Value.TotalAmount, 2).Should().Be(46.75m);
    }

    // ── Catalog prices ───────────────────────────────────────────────────────

    [Fact]
    public void CatalogPrice_MatchingTheTill_IsAccepted()
    {
        CheckoutBuilder.Build(Command(lattePrice: 20.0000m), LoyaltyRules.Default, catalogPrices: _catalog)
            .IsError.Should().BeFalse();
    }

    [Fact]
    public void PriceBelowTheCatalog_IsRejectedForACashier()
    {
        CheckoutBuilder.Build(Command(lattePrice: 10m), LoyaltyRules.Default, catalogPrices: _catalog)
            .FirstError.Code.Should().Be("POS.PriceBelowCatalog");
    }

    [Fact]
    public void PriceBelowTheCatalog_IsAllowedForAManager()
    {
        CheckoutBuilder.Build(Command(lattePrice: 10m, isManager: true), LoyaltyRules.Default, catalogPrices: _catalog)
            .IsError.Should().BeFalse();
    }

    [Fact]
    public void ItemMissingFromTheCatalog_IsRejectedForACashier()
    {
        CheckoutBuilder.Build(Command(lattePrice: 0.01m), LoyaltyRules.Default, catalogPrices: new Dictionary<Guid, decimal> { [_cookie] = 11.50m })
            .FirstError.Code.Should().Be("POS.UnknownVariant");
    }

    [Fact]
    public void ItemMissingFromTheCatalog_IsAllowedForAManager()
    {
        CheckoutBuilder.Build(Command(lattePrice: 10m, isManager: true), LoyaltyRules.Default, catalogPrices: new Dictionary<Guid, decimal>())
            .IsError.Should().BeFalse();
    }

    // ── Offline sales ────────────────────────────────────────────────────────

    [Fact]
    public void OfflineSale_PricedBelowTheCatalog_IsAccepted()
    {
        // The owner raised the latte while the till was offline; the sale was already paid at the old price.
        ErrorOr<Order> result = CheckoutBuilder.Build(
            Command(lattePrice: 10m, offlineCreatedAt: DateTime.UtcNow.AddMinutes(-30)),
            LoyaltyRules.Default, catalogPrices: _catalog);

        result.IsError.Should().BeFalse();
        result.Value.OfflineCreatedAt.Should().NotBeNull();
    }

    [Fact]
    public void OfflineSale_WithAManagersDiscount_IsAcceptedUnderACashiersSession()
    {
        CheckoutBuilder.Build(
            Command(DiscountType.Percentage, 30m, offlineCreatedAt: DateTime.UtcNow.AddMinutes(-30)),
            LoyaltyRules.Default, catalogPrices: _catalog)
            .IsError.Should().BeFalse();
    }

    [Fact]
    public void OfflineSale_WithAnItemNoLongerInTheCatalog_IsAccepted()
    {
        CheckoutBuilder.Build(
            Command(offlineCreatedAt: DateTime.UtcNow.AddMinutes(-30)),
            LoyaltyRules.Default, catalogPrices: new Dictionary<Guid, decimal>())
            .IsError.Should().BeFalse();
    }
}
