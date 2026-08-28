using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Tax.Application.Commands.RemoveTenantFromTaxScope;

public sealed record RemoveTenantFromTaxScopeCommand(
    Guid MembershipId,
    string? Reason,
    Guid ActorId) : ICommand<bool>;
