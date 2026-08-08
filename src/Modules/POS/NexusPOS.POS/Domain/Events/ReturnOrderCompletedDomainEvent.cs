using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.Domain.Events;

public sealed record ReturnOrderCompletedDomainEvent(
    Guid ReturnOrderId,
    Guid OriginalOrderId,
    Guid TenantId,
    Guid BranchId,
    decimal RefundAmount,
    string Currency,
    IReadOnlyList<ReturnOrderCompletedDomainEvent.LineItem> Lines) : DomainEvent
{
    public sealed record LineItem(Guid VariantId, decimal Quantity);
}
