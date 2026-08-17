using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.CompleteOrder;

public sealed record CompleteOrderCommand(
    Guid OrderId,
    Guid BranchId,
    PaymentMethod PaymentMethod,
    decimal AmountTendered,
    decimal? CashAmount = null,
    decimal? CardAmount = null) : ICommand<OrderResponse>;
