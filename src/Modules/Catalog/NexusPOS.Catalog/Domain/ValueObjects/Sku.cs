using ErrorOr;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Catalog.Domain.ValueObjects;

public sealed class Sku : ValueObject
{
    public string Value { get; }

    private Sku(string value)
    {
        Value = value;
    }

    public static ErrorOr<Sku> Create(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return Error.Validation("Catalog.Sku.Empty", "SKU must not be empty.");
        }

        string normalized = value.Trim().ToUpperInvariant();

        if (normalized.Length > 64)
        {
            return Error.Validation("Catalog.Sku.TooLong", "SKU must not exceed 64 characters.");
        }

        return new Sku(normalized);
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value;
}
