using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.Domain.Events;

public sealed record OrderCompletedDomainEvent(
    Guid OrderId,
    Guid TenantId,
    Guid BranchId,
    decimal SubtotalAmount,
    decimal DiscountAmount,
    decimal TaxAmount,
    decimal Total,
    string Currency,
    PaymentMethod PaymentMethod,
    IReadOnlyList<OrderCompletedDomainEvent.LineItem> Lines) : DomainEvent
{
    public sealed record LineItem(Guid VariantId, decimal Quantity);
}
