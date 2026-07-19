namespace NexusPOS.POS.Presentation.Requests;

public sealed record CreateOrderRequest(
    Guid TenantId,
    string Currency,
    Guid? CustomerId = null,
    decimal TaxRate = 0m);
