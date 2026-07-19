using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.CreatePurchaseOrder;

public sealed record CreatePurchaseOrderCommand(
    Guid TenantId,
    Guid BranchId,
    Guid SupplierId,
    DateTime? ExpectedDeliveryDate = null,
    string? Notes = null) : ICommand<PurchaseOrderResponse>;
