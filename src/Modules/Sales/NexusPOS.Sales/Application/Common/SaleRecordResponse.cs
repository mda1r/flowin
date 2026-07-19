using NexusPOS.POS.Domain.Enums;

namespace NexusPOS.Sales.Application.Common;

public sealed record SaleRecordResponse(
    Guid Id,
    Guid OrderId,
    Guid BranchId,
    string Currency,
    decimal SubtotalAmount,
    decimal DiscountAmount,
    decimal TaxAmount,
    decimal TotalAmount,
    PaymentMethod PaymentMethod,
    DateTime CompletedAt);
