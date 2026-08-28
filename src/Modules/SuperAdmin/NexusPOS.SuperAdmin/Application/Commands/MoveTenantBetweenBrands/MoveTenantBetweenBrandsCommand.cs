using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;

namespace NexusPOS.SuperAdmin.Application.Commands.MoveTenantBetweenBrands;

public sealed record MoveTenantBetweenBrandsCommand(
    Guid TenantId,
    Guid TargetBrandId,
    string? NewBranchDisplayName,
    string? NewBranchCode,
    Guid ActorId) : ICommand<BrandMemberResponse>;
