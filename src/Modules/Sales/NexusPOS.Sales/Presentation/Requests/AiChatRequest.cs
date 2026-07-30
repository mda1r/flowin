using NexusPOS.Sales.Application.Commands.AiChat;

namespace NexusPOS.Sales.Presentation.Requests;

public sealed record AiChatRequest(
    string Message,
    IReadOnlyList<AiChatMessage>? History);
