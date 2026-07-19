using ErrorOr;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.POS.Domain.ValueObjects;

public sealed class Discount : ValueObject
{
    public DiscountType Type { get; }
    public decimal Value { get; }

    private Discount(DiscountType type, decimal value)
    {
        Type = type;
        Value = value;
    }

    public static Discount None() => new(DiscountType.None, 0m);

    public static ErrorOr<Discount> Create(DiscountType type, decimal value)
    {
        if (type == DiscountType.None)
        {
            return new Discount(DiscountType.None, 0m);
        }

        if (value < 0)
        {
            return PosErrors.InvalidDiscountValue;
        }

        if (type == DiscountType.Percentage && value > 100)
        {
            return PosErrors.DiscountPercentageExceedsHundred;
        }

        return new Discount(type, value);
    }

    public decimal ComputeAmount(decimal subtotal)
    {
        return Type switch
        {
            DiscountType.None => 0m,
            DiscountType.Percentage => Math.Round(subtotal * Value / 100m, 4),
            DiscountType.Fixed => Math.Min(Value, subtotal),
            _ => 0m,
        };
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Type;
        yield return Value;
    }
}
