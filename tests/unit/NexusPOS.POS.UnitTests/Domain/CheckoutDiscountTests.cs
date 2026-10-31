using FluentAssertions;
using FluentValidation.Results;
using NexusPOS.POS.Application.Commands.Checkout;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class CheckoutDiscountTests
{
    private static readonly Guid _rice = Guid.NewGuid();
    private static readonly Guid _milk = Guid.NewGuid();

    // 2 × 20 + 1 × 10 = 50 net, 57.50 with VAT.
    private static CheckoutOrderCommand Command(
        DiscountType type = DiscountType.None, decimal value = 0m, decimal tendered = 100m, int points = 0,
        Guid? customer = null, DiscountType lineType = DiscountType.None, decimal lineValue = 0m,
        decimal ricePrice = 20m, string? pin = null, bool manager = false) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, customer,
            [new(_rice, "أرز", "5 كغ", ricePrice, 12m, 2m, lineType, lineValue), new(_milk, "حليب", "", 10m, 6m, 1m)],
            points, PaymentMethod.Cash, tendered, null, null, null, type, value, pin, manager);

    [Fact]
    public void CartPercentageDiscount_LowersTheTotal()
    {
        Order order = CheckoutBuilder.Build(Command(DiscountType.Percentage, 10m), LoyaltyRules.Default).Value;

        order.DiscountAmount.Should().Be(5m);
        order.TotalAmount.Should().Be(51.75m);
        DiscountApproval.ManualDiscountPercent(order).Should().Be(10m);
    }

    [Fact]
    public void CartFixedDiscount_IsTakenInNetRiyals()
    {
        Order order = CheckoutBuilder.Build(Command(DiscountType.Fixed, 10m), LoyaltyRules.Default).Value;

        order.TotalAmount.Should().Be(46m);
        DiscountApproval.ManualDiscountPercent(order).Should().Be(20m);
    }

    [Fact]
    public void LineDiscount_ReducesOnlyThatLine()
    {
        Order order = CheckoutBuilder.Build(Command(lineType: DiscountType.Percentage, lineValue: 50m), LoyaltyRules.Default).Value;

        order.Lines.Single(l => l.VariantId == _rice).LineTotal.Should().Be(20m);
        order.SubtotalAmount.Should().Be(30m);
        DiscountApproval.ManualDiscountPercent(order).Should().Be(40m);
    }

    [Fact]
    public void CartDiscount_ComesOffBeforeLoyalty_AndPointsAreNotCountedAsAManualDiscount()
    {
        // 10% off 57.50 leaves 51.75; 100 points at the default 0.05 take another 5.
        Order order = CheckoutBuilder.Build(
            Command(DiscountType.Percentage, 10m, points: 100, customer: Guid.NewGuid()), LoyaltyRules.Default).Value;

        Math.Round(order.TotalAmount, 2).Should().Be(46.75m);
        DiscountApproval.ManualDiscountPercent(order).Should().Be(10m);
    }

    [Fact]
    public void APercentageAboveHundred_IsRejectedByTheValidator()
    {
        ValidationResult result = new CheckoutOrderCommandValidator().Validate(Command(DiscountType.Percentage, 120m));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void ALineDiscountAboveHundredPercent_FailsTheBuild()
    {
        CheckoutBuilder.Build(Command(lineType: DiscountType.Percentage, lineValue: 150m), LoyaltyRules.Default)
            .FirstError.Should().Be(PosErrors.DiscountPercentageExceedsHundred);
    }

    [Fact]
    public void WithinTheCap_NeedsNoApproval()
    {
        DiscountApproval.NeedsPin(10m, false, null, null).Value.Should().BeFalse();
    }

    [Fact]
    public void OwnersAndManagers_AreNeverCapped()
    {
        DiscountApproval.NeedsPin(80m, true, null, null).Value.Should().BeFalse();
    }

    [Fact]
    public void AboveTheCap_WithoutABranchPin_NeedsTheManager()
    {
        DiscountApproval.NeedsPin(15m, false, null, "1234")
            .FirstError.Code.Should().Be("POS.DiscountNeedsManager");
    }

    [Fact]
    public void AboveTheCap_AsksForThePin_ThenSendsItToBeChecked()
    {
        PosBranchSettings settings = SettingsWithPin("4826");

        DiscountApproval.NeedsPin(15m, false, settings, null)
            .FirstError.Code.Should().Be("POS.DiscountApprovalRequired");
        DiscountApproval.NeedsPin(15m, false, settings, "4826").Value.Should().BeTrue();
    }

    [Fact]
    public void TheCap_ComesFromTheBranchSettings()
    {
        PosBranchSettings settings = PosBranchSettings.Create(Guid.NewGuid(), Guid.NewGuid());
        settings.SetMaxCashierDiscount(25m);

        DiscountApproval.NeedsPin(20m, false, settings, null).Value.Should().BeFalse();
    }

    [Fact]
    public void ALiveRequestClaimingToBeOffline_IsStillChecked()
    {
        DateTime now = DateTime.UtcNow;

        OfflineSale.IsOffline(now, now).Should().BeFalse();
        OfflineSale.IsOffline(now.AddSeconds(-30), now).Should().BeFalse();
        OfflineSale.IsOffline(now.AddMinutes(5), now).Should().BeFalse();
        OfflineSale.IsOffline(null, now).Should().BeFalse();
        OfflineSale.IsOffline(now.AddMinutes(-10), now).Should().BeTrue();
    }

    [Fact]
    public void PinHash_VerifiesOnlyTheSamePin()
    {
        string hash = ApprovalPinHasher.Hash("4826");

        hash.Should().NotContain("4826");
        ApprovalPinHasher.Verify("4826", hash).Should().BeTrue();
        ApprovalPinHasher.Verify("4827", hash).Should().BeFalse();
        ApprovalPinHasher.Verify("4826", "garbage").Should().BeFalse();
    }

    [Fact]
    public void CatalogPrice_IsAccepted_EvenAfterRoundingToFourPlaces()
    {
        // 23 with VAT is 20 net; the till sends 20.0000, and 9.99 with VAT rounds to 8.687.
        CheckoutOrderCommand cmd = Command(ricePrice: 20m) with
        {
            Lines = [new(_rice, "أرز", "", 20m, 12m, 1m), new(_milk, "حليب", "", 8.687m, 6m, 1m)],
        };

        CatalogPriceCheck.Check(cmd, Shelf(23m, 9.99m)).IsError.Should().BeFalse();
    }

    [Fact]
    public void APriceBelowTheCatalogue_IsRejected()
    {
        CatalogPriceCheck.Check(Command(ricePrice: 15m), Shelf(23m, 11.5m))
            .FirstError.Code.Should().Be("POS.PriceBelowCatalog");
    }

    [Fact]
    public void AnUnknownVariant_IsRejected()
    {
        CatalogPriceCheck.Check(Command(), new Dictionary<Guid, decimal> { [_rice] = 23m })
            .FirstError.Code.Should().Be("POS.UnknownProduct");
    }

    [Fact]
    public void AnOfflineSale_NamesTheLinesBelowTheCatalogue_ForReview()
    {
        CatalogPriceCheck.Unverified(Command(ricePrice: 15m), Shelf(23m, 11.5m)).Should().Equal("أرز");
    }

    private static Dictionary<Guid, decimal> Shelf(decimal rice, decimal milk) => new() { [_rice] = rice, [_milk] = milk };

    private static PosBranchSettings SettingsWithPin(string pin)
    {
        PosBranchSettings settings = PosBranchSettings.Create(Guid.NewGuid(), Guid.NewGuid());
        settings.SetApprovalPinHash(ApprovalPinHasher.Hash(pin));
        return settings;
    }
}
