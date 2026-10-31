namespace NexusPOS.SharedKernel.Domain.Events;

// Cross-module contract: a sale whose drinks must no longer be made. POS publishes it when the sale is cancelled
// or fully returned, and Restaurant cancels the sale's kitchen ticket unless it was already handed over.
// Reason is the text the kitchen records on the ticket.
public sealed record KitchenTicketVoidRequestedDomainEvent(
    Guid TenantId,
    Guid BranchId,
    Guid SourceOrderId,
    string Reason) : DomainEvent
{
    public const string ReturnedReason = "استرجاع البيع";
    public const string CancelledReason = "إلغاء البيع";
}
