namespace NexusPOS.SharedKernel.Domain.ValueObjects;

public sealed class Money : ValueObject
{
    public decimal Amount { get; }
    public string Currency { get; }

    private Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    public static Money Of(decimal amount, string currency)
    {
        if (string.IsNullOrWhiteSpace(currency) || currency.Length != 3)
        {
            throw new DomainException("Money.InvalidCurrency", $"Currency '{currency}' is not a valid ISO 4217 code.");
        }

        if (amount < 0)
        {
            throw new DomainException("Money.NegativeAmount", "Money amount cannot be negative.");
        }

        return new Money(Math.Round(amount, 4), currency.ToUpperInvariant());
    }

    public static Money Zero(string currency) => Of(0m, currency);

    public Money Add(Money other)
    {
        ArgumentNullException.ThrowIfNull(other);
        EnsureSameCurrency(other);
        return Of(Amount + other.Amount, Currency);
    }

    public Money Subtract(Money other)
    {
        ArgumentNullException.ThrowIfNull(other);
        EnsureSameCurrency(other);
        if (Amount < other.Amount)
        {
            throw new DomainException("Money.InsufficientAmount", "Resulting money amount would be negative.");
        }

        return Of(Amount - other.Amount, Currency);
    }

    public Money Multiply(decimal factor)
    {
        if (factor < 0)
        {
            throw new DomainException("Money.NegativeFactor", "Multiplication factor cannot be negative.");
        }

        return Of(Amount * factor, Currency);
    }

    public bool IsZero => Amount == 0m;

    private void EnsureSameCurrency(Money other)
    {
        if (Currency != other.Currency)
        {
            throw new DomainException("Money.CurrencyMismatch",
                $"Cannot operate on different currencies: {Currency} and {other.Currency}.");
        }
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }

    public override string ToString() => $"{Amount:F4} {Currency}";
}
