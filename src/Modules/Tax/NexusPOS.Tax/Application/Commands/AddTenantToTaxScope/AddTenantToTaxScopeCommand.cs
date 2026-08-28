using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;

namespace NexusPOS.Tax.Application.Commands.AddTenantToTaxScope;

public sealed record AddTenantToTaxScopeCommand(
    Guid TaxScopeId,
    Guid TenantId,
    DateOnly EffectiveFrom,
    Guid ActorId) : ICommand<TaxScopeMemberResponse>;
