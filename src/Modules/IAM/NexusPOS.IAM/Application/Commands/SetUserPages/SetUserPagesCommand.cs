using NexusPOS.IAM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.SetUserPages;

/// <summary>Sets the pages a staff member may open; null gives back every page their role allows.</summary>
public sealed record SetUserPagesCommand(
    Guid TenantId,
    Guid UserId,
    Guid CurrentUserId,
    IReadOnlyCollection<string> CallerRoles,
    IReadOnlyList<string>? Pages) : ICommand<UserSummaryResponse>;
