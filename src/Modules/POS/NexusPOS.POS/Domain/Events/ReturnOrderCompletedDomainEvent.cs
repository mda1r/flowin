using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.Domain.Events;

public sealed record ReturnOrderCompletedDomainEvent(
    Guid ReturnOrderId,
    Guid OriginalOrderId,
    Guid TenantId,
    Guid BranchId,
    decimal RefundAmount,
    string Currency,
    IReadOnlyList<ReturnOrderCompletedDomainEvent.LineItem> Lines,
    bool RestockItems,
    decimal TaxAmount = 0m,
    ReturnOrderCompletedDomainEvent.CustomerLoyalty? Loyalty = null) : DomainEvent
{
    public sealed record LineItem(Guid VariantId, decimal Quantity);

    // Set when the original sale belonged to a customer, so CRM can reverse its loyalty points. OrderTotal is what was
    // paid, PointsValue what the redeemed points took off it (VAT included). ReturnedShare is the part of the sale's
    // goods returned so far and RefundedToDate the cash refunded so far, both counting this return.
    public sealed record CustomerLoyalty(
        Guid CustomerId,
        decimal OrderTotal,
        int PointsRedeemed,
        decimal PointsValue,
        decimal ReturnedShare,
        decimal RefundedToDate,
        DateTime? OrderCompletedAt);
}
