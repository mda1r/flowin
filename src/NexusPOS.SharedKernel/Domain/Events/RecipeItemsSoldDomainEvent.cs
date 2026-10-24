namespace NexusPOS.SharedKernel.Domain.Events;

// Cross-module contract: a module that sells items outside the POS order flow (e.g. Restaurant menu items)
// raises it when the sale is final; Inventory consumes it to deduct recipe materials.
public sealed record RecipeItemsSoldDomainEvent(
    Guid TenantId,
    Guid SaleId,
    IReadOnlyList<RecipeItemsSoldDomainEvent.Line> Lines) : DomainEvent
{
    public sealed record Line(Guid ItemId, decimal Quantity);
}
