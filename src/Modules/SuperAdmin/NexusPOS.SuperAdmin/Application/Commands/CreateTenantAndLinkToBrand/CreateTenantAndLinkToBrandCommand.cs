using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateTenantAndLinkToBrand;

public sealed record CreateTenantAndLinkToBrandCommand(
    Guid BrandId,
    string Name,
    string Subdomain,
    string AdminEmail,
    string BusinessType,
    string Currency,
    string TimeZone,
    string? BranchDisplayName,
    string? BranchCode,
    Guid ActorId) : ICommand<BrandMemberResponse>;
