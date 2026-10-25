namespace NexusPOS.SharedKernel.Domain.Events;

// Cross-module contract: a module that takes payment outside the POS (gaming sessions, restaurant orders)
// publishes it so POS records a completed sale, which then reaches the shift, sales records and ZATCA.
// Line prices exclude VAT; TaxRate is the fraction applied after Discount (e.g. 0.15).
public sealed record ExternalSaleCompletedDomainEvent(
    Guid TenantId,
    Guid BranchId,
    string Source,
    Guid SourceReferenceId,
    IReadOnlyList<ExternalSaleCompletedDomainEvent.Line> Lines,
    decimal Discount,
    decimal TaxRate,
    string PaymentMethod,
    decimal AmountTendered) : DomainEvent
{
    public const string Gaming = "Gaming";
    public const string Restaurant = "Restaurant";

    public sealed record Line(Guid ItemId, string Name, decimal UnitPrice, decimal Quantity);
}
