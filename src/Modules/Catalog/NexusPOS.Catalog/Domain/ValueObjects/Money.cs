using ErrorOr;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Catalog.Domain.ValueObjects;

public sealed class Money : ValueObject
{
    public decimal Amount { get; }
    public string Currency { get; }

    private Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    public static ErrorOr<Money> Create(decimal amount, string? currency)
    {
        if (amount < 0)
        {
            return Error.Validation("Catalog.Money.NegativeAmount", "Amount must not be negative.");
        }

        if (string.IsNullOrWhiteSpace(currency))
        {
            return Error.Validation("Catalog.Money.EmptyCurrency", "Currency is required.");
        }

        string normalized = currency.Trim().ToUpperInvariant();
        if (normalized.Length != 3)
        {
            return Error.Validation("Catalog.Money.InvalidCurrency", "Currency must be a 3-letter ISO code.");
        }

        return new Money(amount, normalized);
    }

    public static Money Zero(string currency) => new(0m, currency.ToUpperInvariant());

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }

    public override string ToString() => $"{Amount:F2} {Currency}";
}
