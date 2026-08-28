using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;

namespace NexusPOS.SuperAdmin.Application.Commands.LinkTenantToBrand;

public sealed record LinkTenantToBrandCommand(
    Guid BrandId,
    Guid TenantId,
    string? BranchDisplayName,
    string? BranchCode,
    Guid ActorId) : ICommand<BrandMemberResponse>;
