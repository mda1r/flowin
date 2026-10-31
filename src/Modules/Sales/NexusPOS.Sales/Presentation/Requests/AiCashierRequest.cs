namespace NexusPOS.Sales.Presentation.Requests;

public sealed record AiCashierRequest(
    IReadOnlyList<AiCashierMessageDto> Messages,
    IReadOnlyList<AiCashierCartLineDto>? Cart = null,
    decimal? CartTotal = null);

public sealed record AiCashierMessageDto(string Role, string Content);

/// <summary>A line of the POS cart as the cashier screen sees it (prices include VAT).</summary>
public sealed record AiCashierCartLineDto(string VariantId, string Name, decimal Quantity, decimal LineTotal);
