using ErrorOr;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Restaurant.Domain.Entities;

public sealed class DiscountCode : AggregateRoot<DiscountCodeId>
{
    public Guid TenantId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public DiscountCodeType Type { get; private set; }
    public decimal Value { get; private set; }
    public decimal MinOrderAmount { get; private set; }
    public int MaxUses { get; private set; }
    public int UsedCount { get; private set; }
    public DateTime ExpiryDate { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private DiscountCode() { }

    public static ErrorOr<DiscountCode> Create(
        Guid tenantId,
        string code,
        DiscountCodeType type,
        decimal value,
        decimal minOrderAmount,
        int maxUses,
        DateTime expiryDate)
    {
        if (string.IsNullOrWhiteSpace(code))
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

        return new DiscountCode
        {
            Id = new DiscountCodeId(Guid.NewGuid()),
            TenantId = tenantId,
            Code = code.Trim().ToUpperInvariant(),
            Type = type,
            Value = value,
            MinOrderAmount = minOrderAmount < 0 ? 0 : minOrderAmount,
            MaxUses = maxUses < 0 ? 0 : maxUses,
            UsedCount = 0,
            ExpiryDate = expiryDate,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
    }

    public decimal ComputeDiscount(decimal orderAmount)
    {
        if (Type == DiscountCodeType.Percentage)
        {
            return Math.Round(orderAmount * Value / 100m, 4);
        }

        return Math.Min(Value, orderAmount);
    }

    public ErrorOr<Success> Validate(decimal orderAmount)
    {
        if (!IsActive)
        {
            return RestaurantErrors.DiscountCodeInactive;
        }

        if (DateTime.UtcNow > ExpiryDate)
        {
            return RestaurantErrors.DiscountCodeExpired;
        }

        if (MaxUses > 0 && UsedCount >= MaxUses)
        {
            return RestaurantErrors.DiscountCodeMaxUsesReached;
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

    public void Deactivate()
    {
        IsActive = false;
    }
}
