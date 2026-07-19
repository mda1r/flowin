using FluentAssertions;
using NexusPOS.SharedKernel.Domain.Exceptions;
using NexusPOS.SharedKernel.Domain.ValueObjects;

namespace NexusPOS.SharedKernel.UnitTests.Domain;

public sealed class MoneyTests
{
    [Fact]
    public void Of_ValidAmount_CreatesMoneyInstance()
    {
        Money money = Money.Of(100m, "USD");

        money.Amount.Should().Be(100m);
        money.Currency.Should().Be("USD");
    }

    [Fact]
    public void Of_NormalizesLowercaseCurrency()
    {
        Money money = Money.Of(50m, "usd");

        money.Currency.Should().Be("USD");
    }

    [Fact]
    public void Of_RoundsToFourDecimalPlaces()
    {
        Money money = Money.Of(1.123456m, "EUR");

        money.Amount.Should().Be(1.1235m);
    }

    [Theory]
    [InlineData("")]
    [InlineData("US")]
    [InlineData("USDX")]
    [InlineData(null!)]
    public void Of_InvalidCurrency_ThrowsDomainException(string? currency)
    {
        Action act = () => Money.Of(10m, currency!);

        act.Should().Throw<DomainException>()
            .Where(e => e.Code == "Money.InvalidCurrency");
    }

    [Fact]
    public void Of_NegativeAmount_ThrowsDomainException()
    {
        Action act = () => Money.Of(-1m, "USD");

        act.Should().Throw<DomainException>()
            .Where(e => e.Code == "Money.NegativeAmount");
    }

    [Fact]
    public void Zero_CreatesZeroAmountMoney()
    {
        Money zero = Money.Zero("USD");

        zero.Amount.Should().Be(0m);
        zero.IsZero.Should().BeTrue();
    }

    [Fact]
    public void Add_SameCurrency_ReturnsSummedMoney()
    {
        Money a = Money.Of(100m, "USD");
        Money b = Money.Of(50m, "USD");

        Money result = a.Add(b);

        result.Amount.Should().Be(150m);
        result.Currency.Should().Be("USD");
    }

    [Fact]
    public void Add_DifferentCurrencies_ThrowsDomainException()
    {
        Money usd = Money.Of(100m, "USD");
        Money eur = Money.Of(100m, "EUR");

        Action act = () => usd.Add(eur);

        act.Should().Throw<DomainException>()
            .Where(e => e.Code == "Money.CurrencyMismatch");
    }

    [Fact]
    public void Subtract_SameCurrency_ReturnsDifference()
    {
        Money a = Money.Of(100m, "USD");
        Money b = Money.Of(30m, "USD");

        Money result = a.Subtract(b);

        result.Amount.Should().Be(70m);
    }

    [Fact]
    public void Subtract_WouldGoBelowZero_ThrowsDomainException()
    {
        Money a = Money.Of(10m, "USD");
        Money b = Money.Of(20m, "USD");

        Action act = () => a.Subtract(b);

        act.Should().Throw<DomainException>()
            .Where(e => e.Code == "Money.InsufficientAmount");
    }

    [Fact]
    public void Multiply_ValidFactor_ReturnsScaledAmount()
    {
        Money price = Money.Of(100m, "USD");

        Money result = price.Multiply(2.5m);

        result.Amount.Should().Be(250m);
    }

    [Fact]
    public void Multiply_NegativeFactor_ThrowsDomainException()
    {
        Money price = Money.Of(100m, "USD");

        Action act = () => price.Multiply(-1m);

        act.Should().Throw<DomainException>()
            .Where(e => e.Code == "Money.NegativeFactor");
    }

    [Fact]
    public void Equality_SameAmountAndCurrency_AreEqual()
    {
        Money a = Money.Of(100m, "USD");
        Money b = Money.Of(100m, "USD");

        a.Should().Be(b);
        (a == b).Should().BeTrue();
    }

    [Fact]
    public void Equality_DifferentAmount_AreNotEqual()
    {
        Money a = Money.Of(100m, "USD");
        Money b = Money.Of(200m, "USD");

        a.Should().NotBe(b);
        (a != b).Should().BeTrue();
    }

    [Fact]
    public void ToString_ReturnsFormattedString()
    {
        Money money = Money.Of(100m, "USD");

        money.ToString().Should().Be("100.0000 USD");
    }
}
