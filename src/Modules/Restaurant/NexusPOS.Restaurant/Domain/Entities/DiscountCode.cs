using ErrorOr;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Restaurant.Domain.Entities;

// The store's discount codes, shared by the restaurant tables and the cafe till (through IDiscountCodeDirectory).
// Codes are kept trimmed and upper-cased, so "vip" and " VIP " are the same code within a tenant.
// No expiry date means the code never expires; MaxUses 0 means unlimited.
public sealed class DiscountCode : AggregateRoot<DiscountCodeId>
{
    public const int CodeMaxLength = 32;
    public const int LabelMaxLength = 40;

    public Guid TenantId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string? Label { get; private set; }
    public DiscountCodeType Type { get; private set; }
    public decimal Value { get; private set; }
    public decimal MinOrderAmount { get; private set; }
    public int MaxUses { get; private set; }
    public int UsedCount { get; private set; }
    public DateTime? ExpiryDate { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private DiscountCode() { }

    public static string Normalize(string? code) => (code ?? string.Empty).Trim().ToUpperInvariant();

    public static ErrorOr<DiscountCode> Create(
        Guid tenantId,
        string code,
        DiscountCodeType type,
        decimal value,
        decimal minOrderAmount,
        int maxUses,
        DateTime? expiryDate,
        string? label = null)
    {
        DiscountCode discountCode = new()
        {
            Id = new DiscountCodeId(Guid.NewGuid()),
            TenantId = tenantId,
            UsedCount = 0,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        ErrorOr<Success> set = discountCode.Set(code, label, type, value, minOrderAmount, maxUses, expiryDate);
        return set.IsError ? set.Errors : discountCode;
    }

    // Changes what the owner set; the used count stays. Nothing changes when a value is refused.
    public ErrorOr<Success> Update(
        string code,
        string? label,
        DiscountCodeType type,
        decimal value,
        decimal minOrderAmount,
        int maxUses,
        DateTime? expiryDate,
        bool isActive)
    {
        ErrorOr<Success> set = Set(code, label, type, value, minOrderAmount, maxUses, expiryDate);
        if (set.IsError)
        {
            return set.Errors;
        }

        IsActive = isActive;
        return Result.Success;
    }

    private ErrorOr<Success> Set(
        string code,
        string? label,
        DiscountCodeType type,
        decimal value,
        decimal minOrderAmount,
        int maxUses,
        DateTime? expiryDate)
    {
        string normalised = Normalize(code);
        if (normalised.Length == 0)
        {
            return RestaurantErrors.InvalidDiscountCode;
        }

        if (value <= 0)
        {
            return RestaurantErrors.InvalidDiscountValue;
        }

        if (type == DiscountCodeType.Percentage && value > 100)
        {
            return RestaurantErrors.DiscountPercentageExceedsHundred;
        }

        string? trimmedLabel = string.IsNullOrWhiteSpace(label) ? null : label.Trim();
        Code = normalised;
        Label = trimmedLabel is { Length: > LabelMaxLength } ? trimmedLabel[..LabelMaxLength] : trimmedLabel;
        Type = type;
        Value = value;
        MinOrderAmount = minOrderAmount < 0 ? 0 : minOrderAmount;
        MaxUses = maxUses < 0 ? 0 : maxUses;
        ExpiryDate = AsUtc(expiryDate);
        return Result.Success;
    }

    public decimal ComputeDiscount(decimal orderAmount)
    {
        if (Type == DiscountCodeType.Percentage)
        {
            return Math.Round(orderAmount * Value / 100m, 4);
        }

        return Math.Min(Value, orderAmount);
    }

    // Whether the code can be used at all right now, whatever the bill: on, not past its expiry, uses left.
    public ErrorOr<Success> CheckUsable(DateTime utcNow)
    {
        if (!IsActive)
        {
            return RestaurantErrors.DiscountCodeInactive;
        }

        if (ExpiryDate is DateTime expiry && utcNow > expiry)
        {
            return RestaurantErrors.DiscountCodeExpired;
        }

        if (MaxUses > 0 && UsedCount >= MaxUses)
        {
            return RestaurantErrors.DiscountCodeMaxUsesReached;
        }

        return Result.Success;
    }

    public ErrorOr<Success> Validate(decimal orderAmount)
    {
        ErrorOr<Success> usable = CheckUsable(DateTime.UtcNow);
        if (usable.IsError)
        {
            return usable.Errors;
        }

        if (orderAmount < MinOrderAmount)
        {
            return RestaurantErrors.DiscountCodeMinOrderAmountNotMet;
        }

        return Result.Success;
    }

    public void IncrementUsage()
    {
        UsedCount++;
    }

    // A cancelled order gives its use back.
    public void DecrementUsage()
    {
        if (UsedCount > 0)
        {
            UsedCount--;
        }
    }

    public void Activate()
    {
        IsActive = true;
    }

    public void Deactivate()
    {
        IsActive = false;
    }

    private static DateTime? AsUtc(DateTime? value) => value switch
    {
        null => null,
        { Kind: DateTimeKind.Local } v => v.ToUniversalTime(),
        { Kind: DateTimeKind.Unspecified } v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
        _ => value,
    };
}
