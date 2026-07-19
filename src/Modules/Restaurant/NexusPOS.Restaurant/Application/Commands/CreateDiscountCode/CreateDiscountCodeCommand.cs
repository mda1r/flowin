using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.CreateDiscountCode;

public sealed record CreateDiscountCodeCommand(
    Guid TenantId,
    string Code,
    DiscountCodeType Type,
    decimal Value,
    decimal MinOrderAmount,
    int MaxUses,
    DateTime ExpiryDate) : ICommand<DiscountCodeResponse>;
