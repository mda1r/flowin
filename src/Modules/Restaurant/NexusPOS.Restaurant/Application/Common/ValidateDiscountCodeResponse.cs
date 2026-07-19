using NexusPOS.Restaurant.Domain.Enums;

namespace NexusPOS.Restaurant.Application.Common;

public sealed record ValidateDiscountCodeResponse(
    string Code,
    DiscountCodeType Type,
    decimal Value,
    decimal DiscountAmount,
    bool IsValid,
    string? ErrorMessage);
