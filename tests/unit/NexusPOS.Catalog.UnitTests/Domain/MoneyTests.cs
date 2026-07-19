using ErrorOr;
using FluentAssertions;
using NexusPOS.Catalog.Domain.ValueObjects;

namespace NexusPOS.Catalog.UnitTests.Domain;

public sealed class MoneyTests
{
    [Fact]
    public void Create_WithValidValues_ReturnsMoney()
    {
        ErrorOr<Money> result = Money.Create(19.99m, "usd");

        result.IsError.Should().BeFalse();
        result.Value.Amount.Should().Be(19.99m);
        result.Value.Currency.Should().Be("USD");
    }

    [Fact]
    public void Create_WithNegativeAmount_ReturnsError()
    {
        ErrorOr<Money> result = Money.Create(-1m, "USD");

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Catalog.Money.NegativeAmount");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void Create_WithEmptyCurrency_ReturnsError(string? currency)
    {
        ErrorOr<Money> result = Money.Create(10m, currency);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Catalog.Money.EmptyCurrency");
    }

    [Fact]
    public void Create_WithInvalidCurrencyLength_ReturnsError()
    {
        ErrorOr<Money> result = Money.Create(10m, "USDD");

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Catalog.Money.InvalidCurrency");
    }

    [Fact]
    public void Create_WithZeroAmount_Succeeds()
    {
        ErrorOr<Money> result = Money.Create(0m, "EUR");

        result.IsError.Should().BeFalse();
        result.Value.Amount.Should().Be(0m);
    }

    [Fact]
    public void Zero_ReturnsZeroAmountMoney()
    {
        Money zero = Money.Zero("GBP");

        zero.Amount.Should().Be(0m);
        zero.Currency.Should().Be("GBP");
    }

    [Fact]
    public void Equality_SameValues_AreEqual()
    {
        Money m1 = Money.Create(100m, "USD").Value;
        Money m2 = Money.Create(100m, "USD").Value;

        m1.Should().Be(m2);
    }

    [Fact]
    public void Equality_DifferentCurrencies_AreNotEqual()
    {
        Money m1 = Money.Create(100m, "USD").Value;
        Money m2 = Money.Create(100m, "EUR").Value;

        m1.Should().NotBe(m2);
    }
}
