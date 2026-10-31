using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Commands.AiCashier;

public sealed record AiCashierCommand(
    Guid BranchId,
    IReadOnlyList<ClaudeMessage> Messages,
    IReadOnlyList<AiCashierCartLine>? Cart = null,
    decimal? CartTotal = null)
    : ICommand<AiCashierResponse>;

/// <summary>Cart snapshot sent by the POS; line totals and the cart total include VAT.</summary>
public sealed record AiCashierCartLine(string VariantId, string Name, decimal Quantity, decimal LineTotal);
