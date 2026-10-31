using NexusPOS.IAM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.SetUserActive;

public sealed record SetUserActiveCommand(
    Guid TenantId,
    Guid UserId,
    Guid CurrentUserId,
    IReadOnlyCollection<string> CallerRoles,
    bool IsActive) : ICommand<UserSummaryResponse>;
