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

    // The cashier cap, manager PIN and catalog price checks are covered in CheckoutDiscountTests.
    // Two lattes at 20 before VAT (23 listed) and a cookie at 10 (11.50 listed): subtotal 50, total 57.50.
    private static CheckoutOrderCommand Command(
        DiscountType discountType = DiscountType.None, decimal discountValue = 0m,
        decimal lattePrice = 20m, int points = 0, Guid? customer = null) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, customer,
            [new(_latte, "لاتيه", "كبير", lattePrice, 4m, 2m, Notes: "حليب شوفان"), new(_cookie, "كوكيز", "", 10m, 2m, 1m)],
            points, PaymentMethod.Cash, 100m, null, null, null,
            discountType, discountValue);

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
    public void PercentDiscount_LowersTheTotal()
    {
        ErrorOr<Order> result = CheckoutBuilder.Build(Command(DiscountType.Percentage, 10m), LoyaltyRules.Default);

        result.IsError.Should().BeFalse();
        result.Value.DiscountAmount.Should().Be(5m);
        result.Value.TotalAmount.Should().Be(51.75m);
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
}
