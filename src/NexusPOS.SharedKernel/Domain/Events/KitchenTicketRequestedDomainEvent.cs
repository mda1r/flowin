namespace NexusPOS.SharedKernel.Domain.Events;

// Cross-module contract: a cafe sale that the kitchen has to prepare. POS publishes it once the sale is saved
// (also when the same sale is resent), and Restaurant shows it on the kitchen screen as a ticket that is already
// paid, so it can never be settled or counted as revenue a second time. TableNumber is null for takeaway or no table.
// CallName is the customer name the barista calls out at pickup (trimmed, or null when none was given).
public sealed record KitchenTicketRequestedDomainEvent(
    Guid TenantId,
    Guid BranchId,
    Guid OrderId,
    long? OrderNumber,
    int? TableNumber,
    bool Takeaway,
    IReadOnlyList<KitchenTicketRequestedDomainEvent.Line> Lines,
    string? CallName = null) : DomainEvent
{
    public sealed record Line(Guid ItemId, string Name, string VariantName, decimal Quantity, string? Notes);
}
