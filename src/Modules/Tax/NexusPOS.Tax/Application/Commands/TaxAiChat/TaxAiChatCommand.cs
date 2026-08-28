using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Tax.Application.Commands.TaxAiChat;

public sealed record TaxAiChatCommand(
    Guid TenantId,
    Guid? PeriodId,
    string Message) : ICommand<string>;
