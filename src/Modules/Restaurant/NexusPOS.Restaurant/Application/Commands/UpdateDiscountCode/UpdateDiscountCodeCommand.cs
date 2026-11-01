using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.UpdateDiscountCode;

// Replaces what the owner set on a code, including switching it on or off; the used count is kept.
public sealed record UpdateDiscountCodeCommand(
    Guid TenantId,
    Guid Id,
    string Code,
    string? Label,
    DiscountCodeType Type,
    decimal Value,
    decimal MinOrderAmount,
    int MaxUses,
    DateTime? ExpiryDate,
    bool IsActive) : ICommand<DiscountCodeResponse>;
