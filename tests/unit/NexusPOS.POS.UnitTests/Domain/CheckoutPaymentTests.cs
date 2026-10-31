using ErrorOr;
using FluentAssertions;
using FluentValidation.Results;
using NexusPOS.POS.Application.Commands.Checkout;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class CheckoutPaymentTests
{
    // Two lattes at 20 and a cookie at 10 before VAT: total 57.50.
    private static CheckoutOrderCommand Command(
        PaymentMethod method, decimal tendered, decimal? cash = null, decimal? card = null) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, null,
            [new(Guid.NewGuid(), "لاتيه", "كبير", 20m, 4m, 2m), new(Guid.NewGuid(), "كوكيز", "", 10m, 2m, 1m)],
            0, method, tendered, cash, card, null);

    // ── Split ────────────────────────────────────────────────────────────────

    [Fact]
    public void Split_ThatDoesNotAddUp_IsRefusedOnline()
    {
        CheckoutBuilder.Build(Command(PaymentMethod.Split, 57.50m, cash: 10m, card: 37.50m), LoyaltyRules.Default)
            .FirstError.Should().Be(PosErrors.SplitMismatch);
    }

    [Fact]
    public void Split_ThatDoesNotAddUp_IsKeptOffline_WithAReviewNote()
    {
        CheckoutOrderCommand cmd = Command(PaymentMethod.Split, 57.50m, cash: 10m, card: 37.50m);

        ErrorOr<Order> result = CheckoutBuilder.Build(cmd, LoyaltyRules.Default, offline: true);

        result.IsError.Should().BeFalse();
        result.Value.SplitCash.Should().Be(10m);
        result.Value.SplitCard.Should().Be(37.50m);
        CheckoutBuilder.PaymentProblem(cmd, 57.50m)!.Value.Review.Should().Contain("10.00").And.Contain("57.50");
    }

    [Fact]
    public void Split_AHalalaOff_IsAccepted()
    {
        CheckoutBuilder.Build(Command(PaymentMethod.Split, 57.49m, cash: 20m, card: 37.49m), LoyaltyRules.Default)
            .IsError.Should().BeFalse();
    }

    [Fact]
    public void Split_CashPartIsTheRemainder_AndTheLargerNoteGivesChange()
    {
        // 37.50 on the card, a 50 note for the 20 left: 20 is kept as cash and 30 goes back.
        Order order = CheckoutBuilder.Build(Command(PaymentMethod.Split, 87.50m, cash: 20m, card: 37.50m), LoyaltyRules.Default).Value;

        order.SplitCash.Should().Be(20m);
        order.ChangeDue.Should().Be(30m);
    }

    // ── Cash ─────────────────────────────────────────────────────────────────

    [Fact]
    public void Cash_ShortOfTheTotal_IsRefusedOnline()
    {
        CheckoutBuilder.Build(Command(PaymentMethod.Cash, 50m), LoyaltyRules.Default)
            .FirstError.Should().Be(PosErrors.InsufficientPayment);
    }

    [Fact]
    public void Cash_TwoHalalasShort_IsRefusedOnline()
    {
        CheckoutBuilder.Build(Command(PaymentMethod.Cash, 57.48m), LoyaltyRules.Default)
            .FirstError.Should().Be(PosErrors.InsufficientPayment);
    }

    [Fact]
    public void Cash_AHalalaOfRounding_IsAcceptedAsTheTotal()
    {
        Order order = CheckoutBuilder.Build(Command(PaymentMethod.Cash, 57.49m), LoyaltyRules.Default).Value;

        order.AmountTendered.Should().Be(57.50m);
        order.ChangeDue.Should().Be(0m);
    }

    [Fact]
    public void Cash_ShortOffline_IsKeptAtTheTotal_AndDescribedForReview()
    {
        CheckoutOrderCommand cmd = Command(PaymentMethod.Cash, 50m);

        Order order = CheckoutBuilder.Build(cmd, LoyaltyRules.Default, offline: true).Value;

        order.AmountTendered.Should().Be(57.50m);
        CheckoutBuilder.PaymentProblem(cmd, 57.50m)!.Value.Error.Should().Be(PosErrors.InsufficientPayment);
    }

    [Theory]
    [InlineData(PaymentMethod.Card)]
    [InlineData(PaymentMethod.Digital)]
    public void CardAndDigital_ChargeTheTotal_WhateverIsTendered(PaymentMethod method)
    {
        Order order = CheckoutBuilder.Build(Command(method, 0m), LoyaltyRules.Default).Value;

        order.AmountTendered.Should().Be(57.50m);
        CheckoutBuilder.PaymentProblem(Command(method, 0m), 57.50m).Should().BeNull();
    }

    // ── Validator ────────────────────────────────────────────────────────────

    [Fact]
    public void Validator_SplitWithoutBothParts_IsRejected()
    {
        ValidationResult result = new CheckoutOrderCommandValidator().Validate(Command(PaymentMethod.Split, 57.50m, cash: 57.50m));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(CheckoutOrderCommand.CardAmount));
    }

    [Theory]
    [InlineData(PaymentMethod.Split, -5.0, 62.50)]
    [InlineData(PaymentMethod.Cash, -1.0, null)]
    [InlineData(PaymentMethod.Card, null, -1.0)]
    public void Validator_NegativeAmounts_AreRejected(PaymentMethod method, double? cash, double? card)
    {
        ValidationResult result = new CheckoutOrderCommandValidator()
            .Validate(Command(method, 57.50m, (decimal?)cash, (decimal?)card));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validator_ASplitWithBothParts_IsValid()
    {
        new CheckoutOrderCommandValidator().Validate(Command(PaymentMethod.Split, 57.50m, 20m, 37.50m)).IsValid.Should().BeTrue();
    }
}
