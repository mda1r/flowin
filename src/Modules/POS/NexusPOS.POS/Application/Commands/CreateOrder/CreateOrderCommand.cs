using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.CreateOrder;

public sealed record CreateOrderCommand(
    Guid TenantId,
    Guid BranchId,
    string Currency,
    Guid? CustomerId = null,
    decimal TaxRate = 0m) : ICommand<OrderResponse>;
