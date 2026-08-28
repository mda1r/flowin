using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.UnlinkTenantFromBrand;

public sealed record UnlinkTenantFromBrandCommand(
    Guid MembershipId,
    Guid ActorId) : ICommand<bool>;
