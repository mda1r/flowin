using NexusPOS.Restaurant.Domain.Enums;

namespace NexusPOS.Restaurant.Application.Common;

public sealed record DiscountCodeResponse(
    Guid Id,
    Guid TenantId,
    string Code,
    DiscountCodeType Type,
    decimal Value,
    decimal MinOrderAmount,
    int MaxUses,
    int UsedCount,
    DateTime ExpiryDate,
    bool IsActive,
    DateTime CreatedAt);
