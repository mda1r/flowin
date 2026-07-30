using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Commands.AiChat;

public sealed record AiChatCommand(
    Guid BranchId,
    string Message,
    IReadOnlyList<AiChatMessage> History) : ICommand<string>;

public sealed record AiChatMessage(string Role, string Content);
