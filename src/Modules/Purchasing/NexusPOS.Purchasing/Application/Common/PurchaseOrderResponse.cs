using NexusPOS.Purchasing.Domain.Enums;

namespace NexusPOS.Purchasing.Application.Common;

public sealed record PurchaseOrderResponse(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    Guid SupplierId,
    PurchaseOrderStatus Status,
    decimal TotalAmount,
    DateTime? ExpectedDeliveryDate,
    string? Notes,
    DateTime CreatedAt,
    DateTime? ReceivedAt,
    IReadOnlyList<PurchaseOrderLineResponse> Lines);
