namespace NexusPOS.Sales.Presentation.Requests;

public sealed record AiCashierRequest(IReadOnlyList<AiCashierMessageDto> Messages);

public sealed record AiCashierMessageDto(string Role, string Content);
