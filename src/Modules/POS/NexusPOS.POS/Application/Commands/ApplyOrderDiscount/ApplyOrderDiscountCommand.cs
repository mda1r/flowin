using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.ApplyOrderDiscount;

public sealed record ApplyOrderDiscountCommand(
    Guid OrderId,
    Guid BranchId,
    DiscountType DiscountType,
    decimal DiscountValue) : ICommand<OrderResponse>;
