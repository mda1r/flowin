using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.CreateDiscountCode;

// ExpiryDate null: the code never expires. Label is the short name the till and receipt show ("موظفين", "VIP").
public sealed record CreateDiscountCodeCommand(
    Guid TenantId,
    string Code,
    DiscountCodeType Type,
    decimal Value,
    decimal MinOrderAmount,
    int MaxUses,
    DateTime? ExpiryDate,
    string? Label = null) : ICommand<DiscountCodeResponse>;
