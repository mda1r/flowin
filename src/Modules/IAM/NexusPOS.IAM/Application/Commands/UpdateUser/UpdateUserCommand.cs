using NexusPOS.IAM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.UpdateUser;

public sealed record UpdateUserCommand(
    Guid TenantId,
    Guid UserId,
    Guid CurrentUserId,
    IReadOnlyCollection<string> CallerRoles,
    string FirstName,
    string LastName,
    string Role) : ICommand<UserSummaryResponse>;
