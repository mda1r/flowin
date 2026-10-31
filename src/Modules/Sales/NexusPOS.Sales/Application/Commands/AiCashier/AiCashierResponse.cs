namespace NexusPOS.Sales.Application.Commands.AiCashier;

public sealed record AiCashierResponse(
    string Message,
    IReadOnlyList<AiCashierAction> Actions,
    string State);

public sealed record AiCashierAction(
    string Type,
    string? VariantId = null,
    decimal Quantity = 1,
    string? Notes = null,
    string? PaymentMethod = null);
