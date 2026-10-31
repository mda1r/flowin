namespace NexusPOS.SharedKernel.Application.Services;

// Lets a module that takes payment outside the POS (gaming, restaurant) print the invoice number POS gave
// the sale it recorded from ExternalSaleCompletedDomainEvent, without referencing the POS module.
public interface IExternalSaleInvoices
{
    // Null when no sale was recorded for that reference (e.g. a free session).
    Task<long?> FindNumberAsync(string source, Guid sourceReferenceId, CancellationToken cancellationToken = default);
}
