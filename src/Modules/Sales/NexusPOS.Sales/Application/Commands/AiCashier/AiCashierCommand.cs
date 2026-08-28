using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Commands.AiCashier;

public sealed record AiCashierCommand(
    Guid BranchId,
    IReadOnlyList<ClaudeMessage> Messages)
    : ICommand<AiCashierResponse>;
